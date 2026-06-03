import { z } from "zod";
import { apiGet, apiPost, apiPatch, apiDelete, formatError } from "../client.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}

function ok(text: string) {
  return { content: [{ type: "text", text }] };
}

function err(text: string) {
  return { content: [{ type: "text", text }], isError: true };
}

/* ------------------------------------------------------------------ */
//  User / Identity
/* ------------------------------------------------------------------ */

const getMe: ToolDefinition = {
  name: "get_me",
  description: "Get current user profile and wallet overview.",
  inputSchema: z.object({}),
  execute: async () => {
    const r = await apiGet<any>("/users/me");
    if (!r.success) return err(formatError(r));
    const u = r.data;
    const w = u.wallet;
    return ok(
      `User: ${u.email} | Role: ${u.role}\n` +
        `Wallet — USDT: ${w?.usdtBalance ?? 0} | TOKEN: ${w?.tokenBalance ?? 0} | BSC Address: ${w?.bscAddress || "—"}`
    );
  },
};

/* ------------------------------------------------------------------ */
//  Bots
/* ------------------------------------------------------------------ */

const listBots: ToolDefinition = {
  name: "list_bots",
  description: "List all trading bots with their status, mode, and trading pair.",
  inputSchema: z.object({
    status: z.enum(["running", "stopped", "paused", "error"]).optional(),
  }),
  execute: async ({ status }) => {
    const qs = status ? `?status=${status}` : "";
    const r = await apiGet<any[]>(`/bots${qs}`);
    if (!r.success) return err(formatError(r));
    if (!r.data?.length) return ok("No bots found.");
    const lines = r.data.map(
      (b: any) =>
        `- ${b.name} (${b.type.toUpperCase()}) | Status: ${b.status} | Mode: ${b.mode} | Pair: ${b.tradingPair || "—"} | ID: ${b.id}`
    );
    return ok(lines.join("\n"));
  },
};

const getBot: ToolDefinition = {
  name: "get_bot",
  description: "Get detailed info about a specific bot including config and connection.",
  inputSchema: z.object({
    botId: z.string().uuid(),
  }),
  execute: async ({ botId }) => {
    const r = await apiGet<any>(`/bots/${botId}`);
    if (!r.success) return err(formatError(r));
    const b = r.data;
    return ok(
      `Bot: ${b.name}\nType: ${b.type} | Status: ${b.status} | Mode: ${b.mode}\n` +
        `Pair: ${b.tradingPair || "—"} | Leverage: ${b.leverage}x (${b.leverageType})\n` +
        `Connection: ${b.connection?.name} (${b.connection?.exchangeId})\n` +
        `Config: ${JSON.stringify(b.configJson, null, 2)}`
    );
  },
};

const createBot: ToolDefinition = {
  name: "create_bot",
  description: "Create a new DCA or Signal bot. For DCA you must supply full DCA config.",
  inputSchema: z.object({
    name: z.string().min(1),
    connectionId: z.string().uuid(),
    type: z.enum(["dca", "signal"]),
    mode: z.enum(["paper", "live"]).default("paper"),
    tradingPair: z.string().optional(),
    config: z.record(z.any()),
    paperInitialBalance: z.record(z.number()).optional(),
  }),
  execute: async (args) => {
    const r = await apiPost<any>("/bots", {
      name: args.name,
      connectionId: args.connectionId,
      mode: args.mode,
      tradingPair: args.tradingPair,
      config: { type: args.type, ...args.config },
      paperInitialBalance: args.paperInitialBalance,
    });
    if (!r.success) return err(formatError(r));
    return ok(`Bot created: ${r.data.name} | ID: ${r.data.id} | Type: ${r.data.type} | Mode: ${r.data.mode}`);
  },
};

const startBot: ToolDefinition = {
  name: "start_bot",
  description: "Start a stopped bot.",
  inputSchema: z.object({
    botId: z.string().uuid(),
  }),
  execute: async ({ botId }) => {
    const r = await apiPost<any>(`/bots/${botId}/start`, {});
    if (!r.success) return err(formatError(r));
    return ok(`Bot ${botId} started.`);
  },
};

const stopBot: ToolDefinition = {
  name: "stop_bot",
  description: "Stop a running bot.",
  inputSchema: z.object({
    botId: z.string().uuid(),
  }),
  execute: async ({ botId }) => {
    const r = await apiPost<any>(`/bots/${botId}/stop`, {});
    if (!r.success) return err(formatError(r));
    return ok(`Bot ${botId} stopped.`);
  },
};

const deleteBot: ToolDefinition = {
  name: "delete_bot",
  description: "Delete a bot permanently.",
  inputSchema: z.object({
    botId: z.string().uuid(),
  }),
  execute: async ({ botId }) => {
    const r = await apiDelete<any>(`/bots/${botId}`);
    if (!r.success) return err(formatError(r));
    return ok(`Bot ${botId} deleted.`);
  },
};

const listBotOrders: ToolDefinition = {
  name: "list_bot_orders",
  description: "Get order history for a specific bot.",
  inputSchema: z.object({
    botId: z.string().uuid(),
  }),
  execute: async ({ botId }) => {
    const r = await apiGet<any[]>(`/bots/${botId}/orders`);
    if (!r.success) return err(formatError(r));
    if (!r.data?.length) return ok("No orders found.");
    const lines = r.data.map(
      (o: any) =>
        `- ${o.side.toUpperCase()} ${o.symbol} | ${o.amount} @ ${o.price || "market"} | Status: ${o.status} | ${new Date(o.createdAt).toISOString()}`
    );
    return ok(lines.slice(0, 50).join("\n"));
  },
};

const listBotLogs: ToolDefinition = {
  name: "list_bot_logs",
  description: "Get recent logs for a bot. Optional category filter: order, signal, state, trade, alert, system.",
  inputSchema: z.object({
    botId: z.string().uuid(),
    category: z.string().optional(),
    limit: z.number().min(1).max(200).default(50),
  }),
  execute: async ({ botId, category, limit }) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    qs.set("limit", String(limit));
    const r = await apiGet<any[]>(`/bots/${botId}/logs?${qs.toString()}`);
    if (!r.success) return err(formatError(r));
    if (!r.data?.length) return ok("No logs found.");
    const lines = r.data.map((l: any) => `[${l.level.toUpperCase()}] [${l.category}] ${l.message}`);
    return ok(lines.join("\n"));
  },
};

const sendSignal: ToolDefinition = {
  name: "send_signal",
  description:
    "Send a trading signal to a signal bot via webhook. The bot must be running. Provide side (buy/sell), symbol, and optional amount/price.",
  inputSchema: z.object({
    botId: z.string().uuid(),
    side: z.enum(["buy", "sell"]),
    symbol: z.string(),
    amount: z.number().positive().optional(),
    price: z.number().positive().optional(),
  }),
  execute: async ({ botId, side, symbol, amount, price }) => {
    const r = await apiPost<any>(`/webhooks/signal/${botId}`, { side, symbol, amount, price });
    if (!r.success) return err(formatError(r));
    return ok(`Signal queued: ${side.toUpperCase()} ${symbol}`);
  },
};

/* ------------------------------------------------------------------ */
//  Wallet
/* ------------------------------------------------------------------ */

const getWallet: ToolDefinition = {
  name: "get_wallet",
  description: "Get current wallet balances and deposit address.",
  inputSchema: z.object({}),
  execute: async () => {
    const r = await apiGet<any>("/wallets/me");
    if (!r.success) return err(formatError(r));
    const w = r.data;
    return ok(
      `USDT Balance: ${w.usdtBalance} | TOKEN Balance: ${w.tokenBalance}\n` +
        `Total Deposited: ${w.totalDeposited} | Total Withdrawn: ${w.totalWithdrawn}\n` +
        `BSC Deposit Address: ${w.bscAddress || "—"}`
    );
  },
};

const listTransactions: ToolDefinition = {
  name: "list_transactions",
  description: "Get paginated transaction history (deposits, withdrawals, conversions, fees).",
  inputSchema: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }),
  execute: async ({ page, limit }) => {
    const r = await apiGet<any>(`/wallets/transactions?page=${page}&limit=${limit}`);
    if (!r.success) return err(formatError(r));
    if (!r.data?.length) return ok("No transactions found.");
    const lines = r.data.map(
      (t: any) =>
        `- ${t.type} | ${t.amount} ${t.currency} | ${t.status} | ${new Date(t.createdAt).toISOString()}`
    );
    return ok(lines.join("\n") + `\n(Page ${r.meta?.page} of ${Math.ceil((r.meta?.total || 0) / (r.meta?.limit || 1))})`);
  },
};

/* ------------------------------------------------------------------ */
//  Exchange Connections
/* ------------------------------------------------------------------ */

const listConnections: ToolDefinition = {
  name: "list_connections",
  description: "List all exchange API connections.",
  inputSchema: z.object({}),
  execute: async () => {
    const r = await apiGet<any[]>("/exchange-connections");
    if (!r.success) return err(formatError(r));
    if (!r.data?.length) return ok("No exchange connections found.");
    const lines = r.data.map(
      (c: any) => `- ${c.name} (${c.exchangeId}) | Active: ${c.isActive} | ID: ${c.id}`
    );
    return ok(lines.join("\n"));
  },
};

const getConnectionBalance: ToolDefinition = {
  name: "get_connection_balance",
  description: "Get live balance from a connected exchange.",
  inputSchema: z.object({
    connectionId: z.string().uuid(),
  }),
  execute: async ({ connectionId }) => {
    const r = await apiGet<any>(`/exchange-connections/${connectionId}/balance`);
    if (!r.success) return err(formatError(r));
    const balances = Object.entries(r.data || {})
      .filter(([, v]: [string, any]) => v.total > 0)
      .map(([k, v]: [string, any]) => `- ${k}: free ${v.free} | used ${v.used} | total ${v.total}`);
    return ok(balances.join("\n") || "No balances found.");
  },
};

const getMarkets: ToolDefinition = {
  name: "get_markets",
  description: "List available trading pairs on a connected exchange filtered by quote currency.",
  inputSchema: z.object({
    connectionId: z.string().uuid(),
    quote: z.string().default("USDT"),
  }),
  execute: async ({ connectionId, quote }) => {
    const r = await apiGet<any>(`/exchange-connections/${connectionId}/markets?quote=${quote}`);
    if (!r.success) return err(formatError(r));
    const pairs = r.data?.slice(0, 50) || [];
    return ok(pairs.map((p: any) => `- ${p.symbol}`).join("\n") || "No markets found.");
  },
};

const getTicker: ToolDefinition = {
  name: "get_ticker",
  description: "Get current price ticker for a symbol on a specific exchange connection.",
  inputSchema: z.object({
    connectionId: z.string().uuid(),
    symbol: z.string(),
  }),
  execute: async ({ connectionId, symbol }) => {
    const r = await apiGet<any>(`/exchange-connections/${connectionId}/ticker?symbol=${encodeURIComponent(symbol)}`);
    if (!r.success) return err(formatError(r));
    const t = r.data;
    return ok(
      `${t.symbol} | Last: ${t.last} | Bid: ${t.bid} | Ask: ${t.ask} | Change: ${t.changePercent}% | Volume: ${t.volume}`
    );
  },
};

/* ------------------------------------------------------------------ */
//  Export all
/* ------------------------------------------------------------------ */

export const tools: ToolDefinition[] = [
  getMe,
  listBots,
  getBot,
  createBot,
  startBot,
  stopBot,
  deleteBot,
  listBotOrders,
  listBotLogs,
  sendSignal,
  getWallet,
  listTransactions,
  listConnections,
  getConnectionBalance,
  getMarkets,
  getTicker,
];
