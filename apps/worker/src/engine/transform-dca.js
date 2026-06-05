const fs = require('fs');

const SRC = 'C:\\Users\\Renaenys\\Desktop\\BOT\\apps\\worker\\src\\engine\\dca-loop.ts';
let src = fs.readFileSync(SRC, 'utf8');

// Helper to replace a block
function replaceBlock(startMarker, endMarker, newBlock) {
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) {
    console.error('NOT FOUND:', startMarker.slice(0, 60));
    return false;
  }
  const endIdx = src.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    console.error('END NOT FOUND for:', startMarker.slice(0, 60));
    return false;
  }
  src = src.slice(0, startIdx) + newBlock + src.slice(endIdx + endMarker.length);
  return true;
}

// 1. Add helpers before startDcaLoop
const helpers = `
function getDirectionList(cfg: any): ("long" | "short")[] {
  const d = cfg.direction || "long";
  return d === "both" ? ["long", "short"] : [d];
}

function isDual(cfg: any): boolean {
  return cfg.direction === "both";
}

function getDirectionalState(botState: BotState, dir: "long" | "short"): DirectionalState {
  return botState.mode === "dual" ? botState[dir]! : botState.state;
}

function getTotalSessionPnl(botState: BotState): number {
  if (botState.mode === "dual") {
    return botState.long.sessionRealizedPnl + botState.short.sessionRealizedPnl;
  }
  return botState.state.sessionRealizedPnl;
}

`;

src = helpers + src;

// 2. Replace startDcaLoop initialization
const startDcaLoopOld = `export async function startDcaLoop(botId: string): Promise<void> {
  try {
    await registerBot(botId);
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { connection: true },
    });
    if (!bot) {
      await unregisterBot(botId);
      return;
    }

    const cfg = bot.configJson as any;
    const connector = getConnector(bot.connection.exchangeId, bot.mode, botId);
    const symbol = (bot as any).tradingPair || cfg.default_symbol || "BTC/USDT";
    const leverage = cfg.leverage || 1;
    const direction: "long" | "short" = cfg.direction || "long";

    // Connect exchange
    if (bot.mode === "live") {
      await (connector as ExchangeConnector).connect({
        apiKey: decrypt(bot.connection.apiKeyEncrypted),
        secret: decrypt(bot.connection.apiSecretEncrypted),
        passphrase: bot.connection.passphraseEncrypted
          ? decrypt(bot.connection.passphraseEncrypted)
          : undefined,
        testnet: bot.connection.isTestnet,
        leverage,
        symbol,
      });
    } else {
      await (connector as ExchangeConnector).connect({
        apiKey: "",
        secret: "",
        leverage,
        symbol,
      });
    }

    const orderType = cfg.order_type === "market" ? "market" : "limit";

    // Attempt to resume from persisted state
    let state: DirectionalState;
    const persisted = bot.stateJson as any;
    if (persisted && persisted.baseOrderFilled) {
      state = hydrateState(persisted, direction);
      botStates.set(botId, state);
    } else {`;

const startDcaLoopNew = `export async function startDcaLoop(botId: string): Promise<void> {
  try {
    await registerBot(botId);
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { connection: true },
    });
    if (!bot) {
      await unregisterBot(botId);
      return;
    }

    const cfg = bot.configJson as any;
    const connector = getConnector(bot.connection.exchangeId, bot.mode, botId);
    const symbol = (bot as any).tradingPair || cfg.default_symbol || "BTC/USDT";
    const leverage = cfg.leverage || 1;
    const directions = getDirectionList(cfg);
    const dual = isDual(cfg);

    // Connect exchange
    if (bot.mode === "live") {
      await (connector as ExchangeConnector).connect({
        apiKey: decrypt(bot.connection.apiKeyEncrypted),
        secret: decrypt(bot.connection.apiSecretEncrypted),
        passphrase: bot.connection.passphraseEncrypted
          ? decrypt(bot.connection.passphraseEncrypted)
          : undefined,
        testnet: bot.connection.isTestnet,
        leverage,
        symbol,
      });
    } else {
      await (connector as ExchangeConnector).connect({
        apiKey: "",
        secret: "",
        leverage,
        symbol,
      });
    }

    const orderType = cfg.order_type === "limit" ? "limit" : "market";

    // Attempt to resume from persisted state
    let botState: BotState;
    const persisted = bot.stateJson as any;
    if (persisted && (persisted.mode === "dual" || persisted.baseOrderFilled)) {
      botState = hydrateState(persisted);
      botStates.set(botId, botState);
    } else {`;

if (!replaceBlock('export async function startDcaLoop', '    } else {', startDcaLoopNew)) {
  console.error('Failed to replace startDcaLoop');
  process.exit(1);
}

// 3. Replace the initialization else block
const initElseOld = `      // Prevent duplicate base order on worker restart by checking existing orders
      const existingOrders =
        bot.mode === "live"
          ? await prisma.botOrder.findMany({
              where: { botId, side: getEntrySide(direction) },
              orderBy: { createdAt: "asc" },
            })
          : await prisma.paperTrade.findMany({
              where: { botId, side: getEntrySide(direction) },
              orderBy: { createdAt: "asc" },
            });

      if (existingOrders.length > 0) {
        let totalAmount = new Decimal(0);
        let totalCost = new Decimal(0);
        let totalFees = new Decimal(0);
        for (const order of existingOrders) {
          const o = order as any;
          totalAmount = totalAmount.plus(o.filled || o.amount || 0);
          totalCost = totalCost.plus(o.cost || o.totalCost || 0);
          totalFees = totalFees.plus(o.fee || o.simulatedFee || estimateFee(o.cost || 0));
        }
        state = {
          direction,
          baseOrderFilled: true,
          safetyOrdersFilled: Math.max(0, existingOrders.length - 1),
          totalAmount,
          totalCost,
          vwap: calculateVwap(totalAmount, totalCost),
          totalFees,
          highestPrice: 0,
          lowestPrice: 0,
          lastSafetyTick: 0,
          tickCount: 0,
          pendingOrders: [],
          priceHistory: [],
          extremePrice: 0,
          sessionRealizedPnl: 0,
          peakEquity: 0,
          chopCount: 0,
          divisionTiersHit: [],
          breakevenTriggered: false,
          waterfallPausedTicks: 0,
          activeTrailingTier: -1,
        };
        botStates.set(botId, state);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: state.safetyOrdersFilled,
            stateJson: buildStateJson(state) as any,
          },
        });
      } else if (cfg.indicator_type && cfg.indicator_type !== "none") {
        state = createEmptyState(direction);
        botStates.set(botId, state);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: 0,
            stateJson: buildStateJson(state) as any,
          },
        });
        logState({
          botId,
          message: \`DCA bot waiting for \${cfg.indicator_type} signal (\${cfg.indicator_timeframe || "1h"}) before first order\`,
          metadata: {
            indicator_type: cfg.indicator_type,
            indicator_timeframe: cfg.indicator_timeframe,
            direction,
          },
        });
      } else {
        await placeBaseOrder({
          botId,
          symbol,
          orderType,
          leverage,
          connector,
          cfg,
          direction,
          lastPrice: 0, // will fetch ticker inside
        });
        state = botStates.get(botId)!;
      }
    }`;

const initElseNew = `      // Prevent duplicate base order on worker restart by checking existing orders
      if (dual) {
        botState = { mode: "dual", long: createEmptyState("long"), short: createEmptyState("short") };
        botStates.set(botId, botState);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: 0,
            stateJson: buildStateJson(botState) as any,
          },
        });
        logState({
          botId,
          message: \`DCA dual-mode bot initialized\`,
          metadata: { direction: "both" },
        });
      } else {
        const direction = directions[0];
        const existingOrders =
          bot.mode === "live"
            ? await prisma.botOrder.findMany({
                where: { botId, side: getEntrySide(direction) },
                orderBy: { createdAt: "asc" },
              })
            : await prisma.paperTrade.findMany({
                where: { botId, side: getEntrySide(direction) },
                orderBy: { createdAt: "asc" },
              });

        if (existingOrders.length > 0) {
          let totalAmount = new Decimal(0);
          let totalCost = new Decimal(0);
          let totalFees = new Decimal(0);
          for (const order of existingOrders) {
            const o = order as any;
            totalAmount = totalAmount.plus(o.filled || o.amount || 0);
            totalCost = totalCost.plus(o.cost || o.totalCost || 0);
            totalFees = totalFees.plus(o.fee || o.simulatedFee || estimateFee(o.cost || 0));
          }
          const state: DirectionalState = {
            direction,
            baseOrderFilled: true,
            safetyOrdersFilled: Math.max(0, existingOrders.length - 1),
            totalAmount,
            totalCost,
            vwap: calculateVwap(totalAmount, totalCost),
            totalFees,
            highestPrice: 0,
            lowestPrice: 0,
            lastSafetyTick: 0,
            tickCount: 0,
            pendingOrders: [],
            priceHistory: [],
            extremePrice: 0,
            sessionRealizedPnl: 0,
            peakEquity: 0,
            chopCount: 0,
            divisionTiersHit: [],
            breakevenTriggered: false,
            waterfallPausedTicks: 0,
            activeTrailingTier: -1,
          };
          botState = { mode: "single", state };
          botStates.set(botId, botState);
          await prisma.bot.update({
            where: { id: botId },
            data: {
              safetyOrdersPlaced: state.safetyOrdersFilled,
              stateJson: buildStateJson(botState) as any,
            },
          });
        } else if (cfg.indicator_type && cfg.indicator_type !== "none") {
          const state = createEmptyState(direction);
          botState = { mode: "single", state };
          botStates.set(botId, botState);
          await prisma.bot.update({
            where: { id: botId },
            data: {
              safetyOrdersPlaced: 0,
              stateJson: buildStateJson(botState) as any,
            },
          });
          logState({
            botId,
            message: \`DCA bot waiting for \${cfg.indicator_type} signal (\${cfg.indicator_timeframe || "1h"}) before first order\`,
            metadata: {
              indicator_type: cfg.indicator_type,
              indicator_timeframe: cfg.indicator_timeframe,
              direction,
            },
          });
        } else {
          await placeBaseOrder({
            botId,
            symbol,
            orderType,
            leverage,
            connector,
            cfg,
            direction,
            lastPrice: 0, // will fetch ticker inside
          });
          botState = botStates.get(botId)!;
        }
      }
    }`;

if (!replaceBlock(initElseOld, '    }', initElseNew)) {
  console.error('Failed to replace init else block');
  process.exit(1);
}

fs.writeFileSync(SRC, src);
console.log('Transformation done');
