import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useI18n } from "../hooks/use-i18n";
import {
  ArrowLeft,
  Copy,
  Check,
  Terminal,
  Shield,
  Key,
  Bot,
  Plug,
  Wallet,
  Radio,
  ChevronRight,
  Zap,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/api-docs")({
  component: ApiDocsPage,
});

const BASE_URL = typeof window !== "undefined"
  ? window.location.origin.replace(":5173", ":3010").replace(":4173", ":3010")
  : "http://localhost:3010";

interface Endpoint {
  method: string;
  path: string;
  auth: "JWT" | "API Key" | "Both";
  description: string;
  request?: string;
  response?: string;
  query?: string;
}

const SECTIONS = [
  { id: "bots", labelKey: "sectionBots", icon: Bot },
  { id: "exchange-connections", labelKey: "sectionConnections", icon: Plug },
  { id: "signals", labelKey: "sectionSignals", icon: Radio },
  { id: "api-keys", labelKey: "sectionApiKeys", icon: Key },
  { id: "wallets", labelKey: "sectionWallets", icon: Wallet },
];

const ENDPOINTS: Record<string, Endpoint[]> = {
  bots: [
    {
      method: "GET",
      path: "/bots",
      auth: "Both",
      description: "List your trading bots",
      query: "?status=running",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", name: "BTC DCA", type: "dca", status: "running", mode: "paper", tradingPair: "BTC/USDT", connection: { exchangeId: "binance" } }] }, null, 2),
    },
    {
      method: "POST",
      path: "/bots",
      auth: "Both",
      description: "Create a new trading bot (DCA or Signal)",
      request: JSON.stringify({
        name: "BTC DCA",
        connectionId: "uuid",
        tradingPair: "BTC/USDT",
        mode: "paper",
        paperInitialBalance: { USDT: 10000 },
        config: {
          type: "dca",
          base_order_size: 10,
          safety_order_size: 5,
          safety_order_max_count: 5,
          price_deviation_initial: 1.0,
          leverage: 1,
          leverage_type: "cross",
          take_profit: 2,
          take_profit_mode: "fixed",
          direction: "long",
          max_safety_orders_active: 3,
          order_type: "market",
        },
      }, null, 2),
      response: JSON.stringify({ success: true, data: { id: "uuid", name: "BTC DCA", status: "stopped", mode: "paper" } }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id",
      auth: "Both",
      description: "Get bot details including config and connection",
      response: JSON.stringify({ success: true, data: { id: "uuid", name: "BTC DCA", type: "dca", status: "running", configJson: {}, mode: "paper", tradingPair: "BTC/USDT" } }, null, 2),
    },
    {
      method: "PATCH",
      path: "/bots/:id",
      auth: "Both",
      description: "Update bot name or config",
      request: JSON.stringify({ name: "Updated Name", configJson: { type: "dca", base_order_size: 20 } }, null, 2),
      response: JSON.stringify({ success: true, data: { id: "uuid", name: "Updated Name" } }, null, 2),
    },
    {
      method: "POST",
      path: "/bots/:id/start",
      auth: "Both",
      description: "Start a bot (checks token balance for live mode)",
      response: JSON.stringify({ success: true, data: { status: "running" } }, null, 2),
    },
    {
      method: "POST",
      path: "/bots/:id/stop",
      auth: "Both",
      description: "Stop a bot",
      response: JSON.stringify({ success: true, data: { status: "stopped" } }, null, 2),
    },
    {
      method: "POST",
      path: "/bots/:id/exit",
      auth: "Both",
      description: "Emergency exit — close all positions immediately",
      response: JSON.stringify({ success: true, data: { message: "Emergency exit command sent to worker" } }, null, 2),
    },
    {
      method: "POST",
      path: "/bots/:id/sync",
      auth: "Both",
      description: "Manual position sync (DCA bots only)",
      response: JSON.stringify({ success: true, data: { message: "Sync command sent to worker" } }, null, 2),
    },
    {
      method: "PATCH",
      path: "/bots/:id/mode",
      auth: "Both",
      description: "Toggle paper/live mode (bot must be stopped first)",
      request: JSON.stringify({ mode: "live" }, null, 2),
      response: JSON.stringify({ success: true, data: { mode: "live" } }, null, 2),
    },
    {
      method: "DELETE",
      path: "/bots/:id",
      auth: "Both",
      description: "Delete a bot and all its data",
      response: JSON.stringify({ success: true }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id/orders",
      auth: "Both",
      description: "Get order history for a bot",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", side: "buy", amount: 0.01, price: 50000, status: "filled", createdAt: "2024-01-01T00:00:00Z" }] }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id/logs",
      auth: "Both",
      description: "Get bot logs with optional filters",
      query: "?category=state&level=info&limit=200",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", level: "info", message: "Bot started", createdAt: "2024-01-01T00:00:00Z" }] }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id/paper-trades",
      auth: "Both",
      description: "Get paper trading history",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", side: "buy", pnl: 12.5, createdAt: "2024-01-01T00:00:00Z" }] }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id/price",
      auth: "Both",
      description: "Get current market price for the bot's trading pair",
      response: JSON.stringify({ success: true, data: { symbol: "BTC/USDT", last: 50000, bid: 49999, ask: 50001, change24hPct: 2.5 } }, null, 2),
    },
  ],
  "exchange-connections": [
    {
      method: "GET",
      path: "/exchange-connections",
      auth: "Both",
      description: "List your exchange connections",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", name: "Binance Main", exchangeId: "binance", isActive: true }] }, null, 2),
    },
    {
      method: "POST",
      path: "/exchange-connections",
      auth: "Both",
      description: "Add a new exchange API connection (encrypted at rest)",
      request: JSON.stringify({ exchangeId: "binance", name: "Binance Main", apiKey: "xxx", apiSecret: "xxx", passphrase: "optional" }, null, 2),
      response: JSON.stringify({ success: true, data: { id: "uuid", name: "Binance Main", exchangeId: "binance" } }, null, 2),
    },
    {
      method: "DELETE",
      path: "/exchange-connections/:id",
      auth: "Both",
      description: "Remove an exchange connection",
      response: JSON.stringify({ success: true }, null, 2),
    },
    {
      method: "GET",
      path: "/exchange-connections/:id/markets",
      auth: "Both",
      description: "List available markets on the exchange",
      query: "?quote=USDT",
      response: JSON.stringify({ success: true, data: [{ symbol: "BTC/USDT", base: "BTC", quote: "USDT" }] }, null, 2),
    },
    {
      method: "GET",
      path: "/exchange-connections/:id/balance",
      auth: "Both",
      description: "Get real exchange wallet balance",
      response: JSON.stringify({ success: true, data: { USDT: { free: 1000, used: 0, total: 1000 }, BTC: { free: 0.5, used: 0, total: 0.5 } } }, null, 2),
    },
    {
      method: "GET",
      path: "/exchange-connections/:id/ticker",
      auth: "Both",
      description: "Get ticker for a symbol",
      query: "?symbol=BTC/USDT",
      response: JSON.stringify({ success: true, data: { last: 50000, bid: 49999, ask: 50001, volume: 1000 } }, null, 2),
    },
  ],
  signals: [
    {
      method: "POST",
      path: "/webhooks/signal/:botId",
      auth: "Both",
      description: "Send a trading signal to a Signal bot. Supports API key, JWT, or HMAC signature (TradingView).",
      request: JSON.stringify({ side: "buy", symbol: "BTC/USDT", amount: 0.01, price: 50000 }, null, 2),
      response: JSON.stringify({ success: true, data: { queued: true } }, null, 2),
    },
  ],
  "api-keys": [
    {
      method: "GET",
      path: "/api-keys",
      auth: "JWT",
      description: "List your API keys (masked — only prefix shown)",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", name: "Claude Desktop", keyPrefix: "nb_abc12345", permissions: ["bots:read", "bots:write"], lastUsedAt: "2024-01-01" }] }, null, 2),
    },
    {
      method: "POST",
      path: "/api-keys",
      auth: "JWT",
      description: "Generate a new API key (shown ONCE)",
      request: JSON.stringify({ name: "Claude Desktop", permissions: ["bots:read", "bots:write", "connections:read", "signals:write"], expiresAt: null }, null, 2),
      response: JSON.stringify({ success: true, data: { apiKey: "nb_abc12345_xyz...", name: "Claude Desktop", prefix: "nb_abc12345", permissions: ["bots:read", "bots:write"], warning: "This key is shown only once. Store it securely." } }, null, 2),
    },
    {
      method: "DELETE",
      path: "/api-keys/:id",
      auth: "JWT",
      description: "Revoke an API key",
      response: JSON.stringify({ success: true, data: { id: "uuid", revoked: true } }, null, 2),
    },
    {
      method: "PATCH",
      path: "/api-keys/:id",
      auth: "JWT",
      description: "Rename or update permissions",
      request: JSON.stringify({ name: "New Name", permissions: ["bots:read"] }, null, 2),
    },
  ],
  wallets: [
    {
      method: "GET",
      path: "/wallets/me",
      auth: "Both",
      description: "Get your wallet balances",
      response: JSON.stringify({ success: true, data: { usdtBalance: 1000, tokenBalance: 500, bscAddress: "0x...", referralTokenBalance: 100 } }, null, 2),
    },
    {
      method: "POST",
      path: "/wallets/convert",
      auth: "Both",
      description: "Convert USDT to platform tokens",
      request: JSON.stringify({ amount: 100 }, null, 2),
      response: JSON.stringify({ success: true, data: { usdtBalance: 900, tokenBalance: 600 } }, null, 2),
    },
    {
      method: "POST",
      path: "/wallets/generate-address",
      auth: "Both",
      description: "Generate a new BSC deposit address",
      response: JSON.stringify({ success: true, data: { bscAddress: "0x...", bscAddressIndex: 1 } }, null, 2),
    },
    {
      method: "GET",
      path: "/wallets/transactions",
      auth: "Both",
      description: "Get transaction history",
      query: "?page=1&limit=20",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", type: "deposit", amount: 100, currency: "USDT", status: "confirmed" }], meta: { page: 1, limit: 20, total: 5 } }, null, 2),
    },
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute top-2 right-2 p-1 rounded-md text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-[var(--primary)]/10 text-[var(--primary)]",
    POST: "bg-[var(--success)]/10 text-[var(--success)]",
    PATCH: "bg-[var(--warning)]/10 text-[var(--warning)]",
    PUT: "bg-[var(--warning)]/10 text-[var(--warning)]",
    DELETE: "bg-[var(--danger)]/10 text-[var(--danger)]",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${colors[method] || "bg-[var(--bg-hover)] text-[var(--text-muted)]"}`}>
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: string }) {
  const colors: Record<string, string> = {
    JWT: "bg-blue-500/10 text-blue-400",
    "API Key": "bg-purple-500/10 text-purple-400",
    Both: "bg-[var(--accent)]/10 text-[var(--accent)]",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[auth] || ""}`}>
      {auth}
    </span>
  );
}

function EndpointCard({ ep, t }: { ep: Endpoint; t: (k: string) => string }) {
  const curl = `curl -X ${ep.method} \\\n  ${BASE_URL}${ep.path}${ep.query || ""} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>" \\\n  -H "X-API-Key: <api-key>"${ep.request ? ` \\\n  -d '${ep.request}'` : ""}`;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <MethodBadge method={ep.method} />
        <code className="text-xs font-mono text-[var(--text-primary)]">{ep.path}</code>
        <AuthBadge auth={ep.auth} />
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3">{ep.description}</p>

      {ep.query && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">{t("apiDocs.queryParams")}</div>
          <code className="text-[11px] font-mono text-[var(--accent)]">{ep.query}</code>
        </div>
      )}

      {ep.request && (
        <div className="mb-3 relative">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">{t("apiDocs.requestBody")}</div>
          <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)] relative">
            {ep.request}
            <CopyButton text={ep.request} />
          </pre>
        </div>
      )}

      {ep.response && (
        <div className="mb-3 relative">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">{t("apiDocs.response")}</div>
          <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)] relative">
            {ep.response}
            <CopyButton text={ep.response} />
          </pre>
        </div>
      )}

      <div className="relative">
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">{t("apiDocs.curlExample")}</div>
        <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)] whitespace-pre-wrap break-all relative">
          {curl}
          <CopyButton text={curl.replace(/\\\n/g, "\n")} />
        </pre>
      </div>
    </div>
  );
}

function ApiDocsPage() {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState("bots");

  useEffect(() => {
    const el = document.getElementById(`section-${activeSection}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSection]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/ai-integration"
          className="p-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            {t("apiDocs.title")}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {t("apiDocs.subtitle")}
          </p>
        </div>
      </div>

      {/* MCP / AI Quick Reference Banner */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-1">
              {t("apiDocs.quickRef")}
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
              {t("apiDocs.quickRefDesc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/ai-integration"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-[11px] font-medium hover:bg-[var(--primary)]/20 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                {t("apiDocs.aiIntegration")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="hidden lg:block w-[220px] shrink-0 sticky top-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-2 space-y-px">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                    activeSection === s.id
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t(`apiDocs.${s.labelKey}`)}</span>
                  <ChevronRight className={`w-3 h-3 ml-auto shrink-0 transition-transform ${activeSection === s.id ? "rotate-90" : ""}`} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{t("apiDocs.baseUrl")}</span>
            </div>
            <code className="text-[11px] font-mono text-[var(--text-secondary)] break-all">{BASE_URL}</code>
          </div>
        </aside>

        {/* Mobile section selector */}
        <div className="lg:hidden w-full mb-4">
          <select
            value={activeSection}
            onChange={(e) => setActiveSection(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none"
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>{t(`apiDocs.${s.labelKey}`)}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Auth intro */}
          <div id="section-auth" className="scroll-mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">{t("apiDocs.authTitle")}</h2>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                {t("apiDocs.authDesc")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
                <div className="bg-[var(--bg-card)] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold mb-1">{t("apiDocs.apiKeyAuth")}</div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-2">{t("apiDocs.apiKeyAuthDesc")}</p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-2 overflow-x-auto border border-[var(--border-subtle)]">
                      X-API-Key: nb_abc123_xxx...
                      <CopyButton text="X-API-Key: nb_abc123_xxx..." />
                    </pre>
                  </div>
                </div>
                <div className="bg-[var(--bg-card)] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold mb-1">{t("apiDocs.jwtAuth")}</div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-2">{t("apiDocs.jwtAuthDesc")}</p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-2 overflow-x-auto border border-[var(--border-subtle)]">
                      Authorization: Bearer &lt;token&gt;
                      <CopyButton text="Authorization: Bearer <token>" />
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.id} id={`section-${section.id}`} className="scroll-mt-4">
              <div className="flex items-center gap-2 mb-4">
                <section.icon className="w-4 h-4 text-[var(--primary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">{t(`apiDocs.${section.labelKey}`)}</h2>
              </div>
              {ENDPOINTS[section.id]?.map((ep, i) => (
                <EndpointCard key={i} ep={ep} t={t} />
              )) || (
                <p className="text-xs text-[var(--text-muted)]">Documentation coming soon.</p>
              )}
            </div>
          ))}

          {/* Footer note */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 text-center">
            <p className="text-[11px] text-[var(--text-muted)]">
              {t("apiDocs.tradeOnlyNote")}{" "}
              {t("apiDocs.mcpNote")}{" "}
              <Link to="/ai-integration" className="text-[var(--primary)] hover:underline font-medium">
                {t("apiDocs.aiIntegration")}
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
