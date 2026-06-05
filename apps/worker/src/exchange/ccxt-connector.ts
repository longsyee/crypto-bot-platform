import ccxt from "ccxt";
import { prisma } from "@crypto-bot-platform/prisma";
import type { ExchangeConnector } from "./connector";
import { config } from "../config";

export class CCXTConnector implements ExchangeConnector {
  private exchange!: any;

  constructor(
    private exchangeId: string,
    private mode: "paper" | "live" = "live",
    private botId?: string
  ) {}

  async connect(credentials: {
    apiKey: string;
    secret: string;
    passphrase?: string;
    testnet?: boolean;
    leverage?: number;
    symbol?: string;
  }): Promise<void> {
    const ExchangeClass = ccxt[this.exchangeId as keyof typeof ccxt] as any;
    if (!ExchangeClass || !ccxt.exchanges.includes(this.exchangeId)) {
      throw new Error(`Unsupported exchange: ${this.exchangeId}`);
    }
    this.exchange = new ExchangeClass({
      apiKey: credentials.apiKey,
      secret: credentials.secret,
      password: credentials.passphrase,
      enableRateLimit: true,
      options: { defaultType: "swap" }, // Always futures / perpetuals
    });
    if (credentials.testnet && "setSandboxMode" in this.exchange) {
      this.exchange.setSandboxMode(true);
    }

    // Set leverage on the symbol if provided
    if (credentials.leverage && credentials.symbol && credentials.apiKey) {
      try {
        await this.exchange.loadMarkets();
        await this.exchange.setLeverage(
          credentials.leverage,
          credentials.symbol
        );
      } catch (e: any) {
        console.warn(`[CCXT] setLeverage failed: ${e.message}`);
      }
    }
  }

  async placeOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    amount: number;
    price?: number;
    reduceOnly?: boolean;
    positionSide?: "LONG" | "SHORT";
  }) {
    if (this.mode === "paper") {
      await this.paperSyncLimitOrders(params.symbol);
      const result = await this.paperCreateOrder(
        params.symbol,
        params.side,
        params.type,
        params.amount,
        params.price,
        params.reduceOnly,
        params.positionSide
      );
      await this.recordBotOrder(params, result);
      return result;
    }

    // Live futures mode
    await this.exchange.loadMarkets();
    const market = this.exchange.market(params.symbol);
    const feeRate = market.taker || 0.0006; // futures taker fee ~0.06%

    // Estimate required margin before sending
    let notional: number;
    if (params.type === "limit" && params.price) {
      notional = params.amount * params.price;
    } else {
      const ticker = await this.exchange.fetchTicker(params.symbol);
      notional = params.amount * ticker.last;
    }
    const requiredMargin = notional / (market.leverage || 1);

    const balance = await this.exchange.fetchBalance();
    const available = balance["USDT"]?.free || 0;
    if (available < requiredMargin) {
      throw new Error(
        `Insufficient USDT margin: required ${requiredMargin.toFixed(4)} USDT, available ${available.toFixed(4)} USDT`
      );
    }

    const orderParams: any = {};
    if (params.reduceOnly) {
      orderParams.reduceOnly = true;
    }
    if (params.positionSide) {
      orderParams.positionSide = params.positionSide;
    }

    const order = await this.exchange.createOrder(
      params.symbol,
      params.type,
      params.side,
      params.amount,
      params.price,
      orderParams
    );

    const cost = order.cost || notional;
    const fee = cost * feeRate;

    const result = {
      orderId: order.id,
      status: order.status,
      filled: order.filled || 0,
      remaining: order.remaining || params.amount,
      cost,
      fee,
      rawResponse: order,
    };

    await this.recordBotOrder(params, result);
    return result;
  }

  private async recordBotOrder(
    params: {
      symbol: string;
      side: "buy" | "sell";
      type: "market" | "limit";
      amount: number;
      price?: number;
      reduceOnly?: boolean;
      positionSide?: "LONG" | "SHORT";
    },
    order: {
      orderId: string;
      status: string;
      filled: number;
      remaining: number;
      cost: number;
      fee: number;
      rawResponse?: any;
    }
  ) {
    if (!this.botId) return;
    try {
      await prisma.botOrder.create({
        data: {
          botId: this.botId,
          exchangeOrderId: order.orderId,
          symbol: params.symbol,
          side: params.side,
          type: params.type,
          amount: params.amount,
          price: params.price ?? null,
          status: order.status,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          fee: order.fee,
          feeRateAtEntry: config.GLOBAL_FEE_RATE,
          rawCcxtResponseJson: order.rawResponse ? (order.rawResponse as any) : null,
        },
      });
    } catch (e: any) {
      console.warn(`[CCXTConnector] Failed to record BotOrder: ${e.message}`);
    }
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    if (this.mode === "paper") {
      if (!this.botId || !symbol) return;
      await this.paperSyncLimitOrders(symbol);
      const state = await this.paperFetchFuturesState();
      const orders = (state as any).paperOrders || [];
      const idx = orders.findIndex((o: any) => o.orderId === orderId && o.status === "open");
      if (idx === -1) return;
      const order = orders[idx];
      // Return reserved margin for unfilled limit orders
      if (order.type === "limit") {
        const leverage = state.leverage || 1;
        const reservedMargin = (order.amount * (order.price || 0)) / leverage;
        state.USDT += reservedMargin;
      }
      order.status = "canceled";
      order.remaining = 0;
      orders[idx] = order;
      (state as any).paperOrders = orders;
      await prisma.bot.update({
        where: { id: this.botId },
        data: {
          paperBalance: {
            USDT: state.USDT,
            position: state.position,
            entryPrice: state.entryPrice,
            longPosition: state.longPosition,
            longEntryPrice: state.longEntryPrice,
            shortPosition: state.shortPosition,
            shortEntryPrice: state.shortEntryPrice,
            totalFees: state.totalFees,
            realizedPnl: state.realizedPnl,
            leverage: state.leverage,
            paperOrders: orders,
          } as any,
        } as any,
      });
      // Update unified BotOrder ledger
      try {
        await prisma.botOrder.updateMany({
          where: { botId: this.botId, exchangeOrderId: orderId },
          data: { status: "canceled", remaining: 0 },
        });
      } catch (e: any) {
        console.warn(`[CCXTConnector] Failed to update BotOrder on cancel: ${e.message}`);
      }
      return;
    }
    await this.exchange.cancelOrder(orderId, symbol);
  }

  async getOrder(orderId: string, symbol: string) {
    if (this.mode === "paper") {
      await this.paperSyncLimitOrders(symbol);
      const state = await this.paperFetchFuturesState();
      const orders = (state as any).paperOrders || [];
      const o = orders.find((oo: any) => oo.orderId === orderId);
      if (!o) {
        return {
          orderId,
          status: "canceled",
          filled: 0,
          remaining: 0,
          cost: 0,
          fee: 0,
          price: 0,
        };
      }
      return {
        orderId: o.orderId,
        status: o.status,
        filled: o.filled,
        remaining: o.remaining,
        cost: o.cost,
        fee: o.fee,
        price: o.price || 0,
      };
    }
    const order = await this.exchange.fetchOrder(orderId, symbol);
    const feeRate = this.exchange.markets[symbol]?.taker || 0.0006;
    const cost = order.cost || (order.filled || 0) * (order.price || 0);
    return {
      orderId: order.id,
      status: order.status,
      filled: order.filled || 0,
      remaining: order.remaining || 0,
      cost,
      fee: cost * feeRate,
      price: order.price || order.average || 0,
    };
  }

  async fetchFundingRate(symbol: string) {
    const funding = await this.exchange.fetchFundingRate(symbol);
    return {
      fundingRate: funding.fundingRate || 0,
      nextFundingTime: funding.nextFundingTimestamp || 0,
    };
  }

  async getTicker(symbol: string) {
    const ticker = await this.exchange.fetchTicker(symbol);
    return {
      bid: ticker.bid || 0,
      ask: ticker.ask || 0,
      last: ticker.last || 0,
    };
  }

  async fetchPositions(symbol?: string) {
    if (this.mode === "paper") {
      return this.paperFetchPositions(symbol);
    }
    const raw = await this.exchange.fetchPositions(symbol ? [symbol] : undefined);
    return raw.map((p: any) => ({
      symbol: p.symbol || p.contracts,
      side: p.side === "short" ? "short" : "long",
      contracts: p.contracts || 0,
      notional: p.notional || 0,
      entryPrice: p.entryPrice || 0,
      unrealizedPnl: p.unrealizedPnl || 0,
      leverage: p.leverage || 1,
      marginMode: p.marginMode || "cross",
    }));
  }

  async paperFetchPositions(symbol?: string) {
    if (!this.botId) return [];
    const state = await this.paperFetchFuturesState();
    const positions: any[] = [];
    if (state.longPosition > 0) {
      positions.push({
        symbol: symbol || "",
        side: "long" as const,
        contracts: state.longPosition,
        notional: state.longPosition * state.longEntryPrice,
        entryPrice: state.longEntryPrice,
        unrealizedPnl: 0,
        leverage: state.leverage,
        marginMode: "cross",
      });
    }
    if (state.shortPosition > 0) {
      positions.push({
        symbol: symbol || "",
        side: "short" as const,
        contracts: state.shortPosition,
        notional: state.shortPosition * state.shortEntryPrice,
        entryPrice: state.shortEntryPrice,
        unrealizedPnl: 0,
        leverage: state.leverage,
        marginMode: "cross",
      });
    }
    // Fallback for legacy single-mode state
    if (positions.length === 0 && state.position !== 0) {
      positions.push({
        symbol: symbol || "",
        side: state.position > 0 ? "long" : "short",
        contracts: Math.abs(state.position),
        notional: Math.abs(state.position) * state.entryPrice,
        entryPrice: state.entryPrice,
        unrealizedPnl: 0,
        leverage: state.leverage,
        marginMode: "cross",
      });
    }
    return positions;
  }

  // ------------------------------------------------------------------
  // Paper futures trading
  // ------------------------------------------------------------------

  async paperSyncLimitOrders(symbol: string) {
    if (!this.botId) return;
    const state = await this.paperFetchFuturesState();
    const orders: any[] = (state as any).paperOrders || [];
    let changed = false;
    const ticker = await this.exchange.fetchTicker(symbol);
    const currentPrice = ticker.last || 0;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (order.status !== "open" || order.type !== "limit" || order.symbol !== symbol) continue;

      const executionPrice = order.price || currentPrice;
      let shouldFill = false;
      if (order.side === "buy" && currentPrice <= executionPrice) shouldFill = true;
      if (order.side === "sell" && currentPrice >= executionPrice) shouldFill = true;
      if (!shouldFill) continue;

      changed = true;
      const leverage = state.leverage || 1;
      const notional = order.amount * executionPrice;
      const feeRate = 0.0006;
      const fee = notional * feeRate;
      const isDual = order.positionSide !== undefined;

      // Execute fill (same position logic as market order)
      if (order.side === "buy" && !order.reduceOnly) {
        if (isDual) {
          const prevPos = state.longPosition;
          state.longPosition += order.amount;
          state.longEntryPrice =
            state.longPosition > 0 && prevPos >= 0
              ? (state.longEntryPrice * prevPos + executionPrice * order.amount) / state.longPosition
              : executionPrice;
        } else {
          const prevPos = state.position;
          state.position += order.amount;
          state.entryPrice =
            state.position > 0 && prevPos >= 0
              ? (state.entryPrice * prevPos + executionPrice * order.amount) / state.position
              : executionPrice;
        }
        state.totalFees += fee;
        // Deduct fee on fill (margin was already reserved on placement)
        state.USDT -= fee;
      } else if (order.side === "sell" && order.reduceOnly) {
        let pnl = 0;
        if (isDual) {
          if (state.longPosition <= 0) continue;
          const closeAmount = Math.min(order.amount, state.longPosition);
          pnl = (executionPrice - state.longEntryPrice) * closeAmount;
          const marginReleased = (closeAmount * state.longEntryPrice) / leverage;
          state.USDT += marginReleased + pnl - fee;
          state.longPosition -= closeAmount;
        } else {
          if (state.position <= 0) continue;
          const closeAmount = Math.min(order.amount, state.position);
          pnl = (executionPrice - state.entryPrice) * closeAmount;
          const marginReleased = (closeAmount * state.entryPrice) / leverage;
          state.USDT += marginReleased + pnl - fee;
          state.position -= closeAmount;
        }
        state.totalFees += fee;
        state.realizedPnl += pnl - fee;
      } else if (order.side === "sell" && !order.reduceOnly) {
        if (isDual) {
          const prevPos = state.shortPosition;
          state.shortPosition += order.amount;
          state.shortEntryPrice =
            state.shortPosition > 0 && prevPos >= 0
              ? (state.shortEntryPrice * prevPos + executionPrice * order.amount) / state.shortPosition
              : executionPrice;
        } else {
          const prevPos = state.position;
          state.position -= order.amount;
          state.entryPrice =
            state.position < 0 && prevPos <= 0
              ? (state.entryPrice * Math.abs(prevPos) + executionPrice * order.amount) / Math.abs(state.position)
              : executionPrice;
        }
        state.totalFees += fee;
        state.USDT -= fee;
      } else if (order.side === "buy" && order.reduceOnly) {
        let pnl = 0;
        if (isDual) {
          if (state.shortPosition <= 0) continue;
          const closeAmount = Math.min(order.amount, state.shortPosition);
          pnl = (state.shortEntryPrice - executionPrice) * closeAmount;
          const marginReleased = (closeAmount * state.shortEntryPrice) / leverage;
          state.USDT += marginReleased + pnl - fee;
          state.shortPosition -= closeAmount;
        } else {
          if (state.position >= 0) continue;
          const closeAmount = Math.min(order.amount, Math.abs(state.position));
          pnl = (state.entryPrice - executionPrice) * closeAmount;
          const marginReleased = (closeAmount * state.entryPrice) / leverage;
          state.USDT += marginReleased + pnl - fee;
          state.position += closeAmount;
        }
        state.totalFees += fee;
        state.realizedPnl += pnl - fee;
      }

      order.status = "closed";
      order.filled = order.amount;
      order.remaining = 0;
      order.cost = notional;
      order.fee = fee;
      orders[i] = order;

      await prisma.paperTrade.create({
        data: {
          botId: this.botId,
          symbol,
          side: order.side,
          amount: order.amount,
          price: executionPrice,
          simulatedFee: fee,
          totalCost: notional,
          pnl: order.side === "sell" && order.reduceOnly
            ? (executionPrice - (isDual ? state.shortEntryPrice : state.entryPrice)) * order.amount - fee
            : 0,
        } as any,
      });

      // Update unified BotOrder ledger
      try {
        await prisma.botOrder.updateMany({
          where: { botId: this.botId, exchangeOrderId: order.orderId },
          data: {
            status: "closed",
            filled: order.amount,
            remaining: 0,
            cost: notional,
            fee,
          },
        });
      } catch (e: any) {
        console.warn(`[CCXTConnector] Failed to update BotOrder on paper fill: ${e.message}`);
      }
    }

    if (changed) {
      (state as any).paperOrders = orders;
      await prisma.bot.update({
        where: { id: this.botId },
        data: {
          paperBalance: {
            USDT: state.USDT,
            position: state.position,
            entryPrice: state.entryPrice,
            longPosition: state.longPosition,
            longEntryPrice: state.longEntryPrice,
            shortPosition: state.shortPosition,
            shortEntryPrice: state.shortEntryPrice,
            totalFees: state.totalFees,
            realizedPnl: state.realizedPnl,
            leverage: state.leverage,
            paperOrders: orders,
          } as any,
        } as any,
      });
    }
  }

  async paperCreateOrder(
    symbol: string,
    side: "buy" | "sell",
    type: "market" | "limit",
    amount: number,
    price?: number,
    reduceOnly?: boolean,
    positionSide?: "LONG" | "SHORT"
  ) {
    if (!this.botId) {
      throw new Error("paperCreateOrder requires a botId");
    }

    await this.exchange.loadMarkets();
    const ticker = await this.exchange.fetchTicker(symbol);
    const executionPrice = price || ticker.last || ticker.ask || ticker.bid || 0;
    const notional = amount * executionPrice;
    const feeRate = 0.0006; // Futures taker fee 0.06%
    const fee = notional * feeRate;
    const orderId = `paper-${Date.now()}`;

    const state = await this.paperFetchFuturesState();
    const leverage = state.leverage || 1;
    let pnl = 0;

    // Dual/hedge mode: operate on side-specific position fields
    const isDual = positionSide !== undefined;

    if (type === "limit") {
      // Reserve margin for limit order but do not fill position yet
      const requiredMargin = notional / leverage;
      if (state.USDT < requiredMargin) {
        throw new Error(
          `Insufficient paper USDT margin: required ${requiredMargin.toFixed(4)} USDT, available ${state.USDT.toFixed(4)} USDT`
        );
      }
      state.USDT -= requiredMargin;
      const orders = (state as any).paperOrders || [];
      orders.push({
        orderId,
        symbol,
        side,
        type: "limit",
        amount,
        price: executionPrice,
        status: "open",
        filled: 0,
        remaining: amount,
        reduceOnly: reduceOnly || false,
        positionSide,
        fee: 0,
        cost: 0,
        createdAt: Date.now(),
      });
      (state as any).paperOrders = orders;
      await prisma.bot.update({
        where: { id: this.botId },
        data: {
          paperBalance: {
            USDT: state.USDT,
            position: state.position,
            entryPrice: state.entryPrice,
            longPosition: state.longPosition,
            longEntryPrice: state.longEntryPrice,
            shortPosition: state.shortPosition,
            shortEntryPrice: state.shortEntryPrice,
            totalFees: state.totalFees,
            realizedPnl: state.realizedPnl,
            leverage: state.leverage,
            paperOrders: orders,
          } as any,
        } as any,
      });
      return {
        orderId,
        status: "open",
        filled: 0,
        remaining: amount,
        cost: 0,
        fee: 0,
        rawResponse: { mode: "paper", symbol, side, type: "limit", amount, price: executionPrice, status: "open" },
      };
    }

    // Market order: fill immediately
    if (side === "buy" && !reduceOnly) {
      // Open long position
      const requiredMargin = notional / leverage;
      if (state.USDT < requiredMargin + fee) {
        throw new Error(
          `Insufficient paper USDT margin: required ${(requiredMargin + fee).toFixed(4)} USDT, available ${state.USDT.toFixed(4)} USDT`
        );
      }
      state.USDT -= requiredMargin + fee;
      if (isDual) {
        const prevPos = state.longPosition;
        state.longPosition += amount;
        state.longEntryPrice =
          state.longPosition > 0 && prevPos >= 0
            ? (state.longEntryPrice * prevPos + executionPrice * amount) / state.longPosition
            : executionPrice;
      } else {
        const prevPos = state.position;
        state.position += amount;
        state.entryPrice =
          state.position > 0 && prevPos >= 0
            ? (state.entryPrice * prevPos + executionPrice * amount) / state.position
            : executionPrice;
      }
      state.totalFees += fee;
    } else if (side === "sell" && reduceOnly) {
      // Close long position
      if (isDual) {
        if (state.longPosition <= 0) throw new Error("No long position to close");
        const closeAmount = Math.min(amount, state.longPosition);
        pnl = (executionPrice - state.longEntryPrice) * closeAmount;
        const marginReleased = (closeAmount * state.longEntryPrice) / leverage;
        state.USDT += marginReleased + pnl - fee;
        state.longPosition -= closeAmount;
      } else {
        if (state.position <= 0) throw new Error("No long position to close");
        const closeAmount = Math.min(amount, state.position);
        pnl = (executionPrice - state.entryPrice) * closeAmount;
        const marginReleased = (closeAmount * state.entryPrice) / leverage;
        state.USDT += marginReleased + pnl - fee;
        state.position -= closeAmount;
      }
      state.totalFees += fee;
      state.realizedPnl += pnl - fee;
    } else if (side === "sell" && !reduceOnly) {
      // Open short position
      const requiredMargin = notional / leverage;
      if (state.USDT < requiredMargin + fee) {
        throw new Error(
          `Insufficient paper USDT margin: required ${(requiredMargin + fee).toFixed(4)} USDT, available ${state.USDT.toFixed(4)} USDT`
        );
      }
      state.USDT -= requiredMargin + fee;
      if (isDual) {
        const prevPos = state.shortPosition;
        state.shortPosition += amount;
        state.shortEntryPrice =
          state.shortPosition > 0 && prevPos >= 0
            ? (state.shortEntryPrice * prevPos + executionPrice * amount) / state.shortPosition
            : executionPrice;
      } else {
        const prevPos = state.position;
        state.position -= amount;
        state.entryPrice =
          state.position < 0 && prevPos <= 0
            ? (state.entryPrice * Math.abs(prevPos) + executionPrice * amount) / Math.abs(state.position)
            : executionPrice;
      }
      state.totalFees += fee;
    } else if (side === "buy" && reduceOnly) {
      // Close short position
      if (isDual) {
        if (state.shortPosition <= 0) throw new Error("No short position to close");
        const closeAmount = Math.min(amount, state.shortPosition);
        pnl = (state.shortEntryPrice - executionPrice) * closeAmount;
        const marginReleased = (closeAmount * state.shortEntryPrice) / leverage;
        state.USDT += marginReleased + pnl - fee;
        state.shortPosition -= closeAmount;
      } else {
        if (state.position >= 0) throw new Error("No short position to close");
        const closeAmount = Math.min(amount, Math.abs(state.position));
        pnl = (state.entryPrice - executionPrice) * closeAmount;
        const marginReleased = (closeAmount * state.entryPrice) / leverage;
        state.USDT += marginReleased + pnl - fee;
        state.position += closeAmount;
      }
      state.totalFees += fee;
      state.realizedPnl += pnl - fee;
    }

    await prisma.bot.update({
      where: { id: this.botId },
      data: {
        paperBalance: {
          USDT: state.USDT,
          position: state.position,
          entryPrice: state.entryPrice,
          longPosition: state.longPosition,
          longEntryPrice: state.longEntryPrice,
          shortPosition: state.shortPosition,
          shortEntryPrice: state.shortEntryPrice,
          totalFees: state.totalFees,
          realizedPnl: state.realizedPnl,
          leverage: state.leverage,
          paperOrders: (state as any).paperOrders || [],
        } as any,
      } as any,
    });

    await prisma.paperTrade.create({
      data: {
        botId: this.botId,
        symbol,
        side,
        amount,
        price: executionPrice,
        simulatedFee: fee,
        totalCost: notional,
        pnl: side === "sell" && reduceOnly
          ? (executionPrice - (isDual ? state.shortEntryPrice : state.entryPrice)) * amount - fee
          : 0,
      } as any,
    });

    return {
      orderId,
      status: "closed",
      filled: amount,
      remaining: 0,
      cost: notional,
      fee,
      rawResponse: { mode: "paper", symbol, side, type: "market", amount, price: executionPrice, notional, fee },
    };
  }

  async paperFetchFuturesState(): Promise<{
    USDT: number;
    position: number;
    entryPrice: number;
    longPosition: number;
    longEntryPrice: number;
    shortPosition: number;
    shortEntryPrice: number;
    totalFees: number;
    realizedPnl: number;
    leverage: number;
    paperOrders?: any[];
  }> {
    if (!this.botId) {
      return { USDT: 10000, position: 0, entryPrice: 0, longPosition: 0, longEntryPrice: 0, shortPosition: 0, shortEntryPrice: 0, totalFees: 0, realizedPnl: 0, leverage: 1, paperOrders: [] };
    }

    const bot = await prisma.bot.findUnique({
      where: { id: this.botId },
      select: { paperBalance: true, paperInitialBalance: true, leverage: true } as any,
    });

    if (!bot) {
      return { USDT: 10000, position: 0, entryPrice: 0, longPosition: 0, longEntryPrice: 0, shortPosition: 0, shortEntryPrice: 0, totalFees: 0, realizedPnl: 0, leverage: 1, paperOrders: [] };
    }

    const b = (bot as any).paperBalance || {};
    const initial = ((bot as any).paperInitialBalance as Record<string, number> | null) || { USDT: 0 };
    const leverage = (bot as any).leverage || 1;

    // Seed from wallet SimFunds if paperInitialBalance is empty (backward compat)
    let seedUSDT = initial.USDT || 0;
    if (seedUSDT === 0 && this.botId) {
      try {
        const botRecord = await prisma.bot.findUnique({
          where: { id: this.botId },
          select: { userId: true },
        });
        if (botRecord?.userId) {
          const wallet = await prisma.wallet.findUnique({
            where: { userId: botRecord.userId },
            select: { simFundsBalance: true },
          });
          seedUSDT = wallet?.simFundsBalance?.toNumber() ?? 0;
        }
      } catch (_e) {
        seedUSDT = 0;
      }
    }

    if (b.position === undefined || b.USDT === undefined) {
      return {
        USDT: seedUSDT,
        position: 0,
        entryPrice: 0,
        longPosition: 0,
        longEntryPrice: 0,
        shortPosition: 0,
        shortEntryPrice: 0,
        totalFees: 0,
        realizedPnl: 0,
        leverage,
        paperOrders: b.paperOrders || [],
      };
    }

    const longPosition = b.longPosition !== undefined ? b.longPosition : (b.position > 0 ? b.position : 0);
    const shortPosition = b.shortPosition !== undefined ? b.shortPosition : (b.position < 0 ? Math.abs(b.position) : 0);
    const longEntryPrice = b.longEntryPrice !== undefined ? b.longEntryPrice : (b.position > 0 ? b.entryPrice : 0);
    const shortEntryPrice = b.shortEntryPrice !== undefined ? b.shortEntryPrice : (b.position < 0 ? b.entryPrice : 0);

    return {
      USDT: b.USDT ?? seedUSDT,
      position: b.position || 0,
      entryPrice: b.entryPrice || 0,
      longPosition,
      longEntryPrice,
      shortPosition,
      shortEntryPrice,
      totalFees: b.totalFees || 0,
      realizedPnl: b.realizedPnl || 0,
      leverage: b.leverage || leverage,
      paperOrders: b.paperOrders || [],
    };
  }

  async fetchOHLCV(symbol: string, timeframe = "1h", limit = 50) {
    await this.exchange.loadMarkets();
    const raw = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return raw.map((c: number[]) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));
  }
}
