import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  Terminal,
  Shield,
  Key,
  Bot,
  Wallet,
  Plug,
  Users,
  Trophy,
  Activity,
  Server,
  BookOpen,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/api-docs")({
  component: ApiDocsPage,
});

const BASE_URL = typeof window !== "undefined"
  ? window.location.origin.replace(":5173", ":3010").replace(":4173", ":3010")
  : "http://localhost:3010";

const SECTIONS = [
  { id: "auth", label: "Authentication", icon: Shield },
  { id: "users", label: "Users", icon: Users },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "bots", label: "Bots", icon: Bot },
  { id: "exchange-connections", label: "Exchange Connections", icon: Plug },
  { id: "wallets", label: "Wallets", icon: Wallet },
  { id: "referrals", label: "Referrals", icon: Users },
  { id: "logs", label: "Logs", icon: Activity },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "admin", label: "Admin", icon: Server },
  { id: "health", label: "Health", icon: Server },
];

interface Endpoint {
  method: string;
  path: string;
  auth: "JWT" | "API Key" | "Both" | "Admin";
  description: string;
  request?: string;
  response?: string;
  query?: string;
}

const ENDPOINTS: Record<string, Endpoint[]> = {
  auth: [
    {
      method: "POST",
      path: "/auth/register",
      auth: "JWT",
      description: "Register a new user account",
      request: JSON.stringify({ email: "user@example.com", password: "SecurePass123", referral_code: "OPTIONAL" }, null, 2),
      response: JSON.stringify({ success: true, data: { id: "uuid", email: "user@example.com", role: "user" } }, null, 2),
    },
    {
      method: "POST",
      path: "/auth/login",
      auth: "JWT",
      description: "Authenticate and receive access + refresh tokens",
      request: JSON.stringify({ email: "user@example.com", password: "SecurePass123" }, null, 2),
      response: JSON.stringify({ success: true, data: { accessToken: "jwt...", refreshToken: "jwt...", user: { id: "uuid", email: "user@example.com", role: "user" } } }, null, 2),
    },
    {
      method: "POST",
      path: "/auth/verify-email",
      auth: "JWT",
      description: "Verify email with OTP sent during registration",
      request: JSON.stringify({ email: "user@example.com", otp: "123456" }, null, 2),
      response: JSON.stringify({ success: true, data: { verified: true } }, null, 2),
    },
    {
      method: "POST",
      path: "/auth/resend-otp",
      auth: "JWT",
      description: "Resend email verification OTP",
      request: JSON.stringify({ email: "user@example.com" }, null, 2),
    },
    {
      method: "POST",
      path: "/auth/forgot-password",
      auth: "JWT",
      description: "Request password reset email",
      request: JSON.stringify({ email: "user@example.com" }, null, 2),
    },
    {
      method: "POST",
      path: "/auth/reset-password",
      auth: "JWT",
      description: "Reset password using token from email",
      request: JSON.stringify({ token: "reset-token", password: "NewPass123" }, null, 2),
    },
    {
      method: "POST",
      path: "/auth/refresh",
      auth: "JWT",
      description: "Refresh access token using refresh token",
      request: JSON.stringify({ refreshToken: "jwt..." }, null, 2),
      response: JSON.stringify({ success: true, data: { accessToken: "jwt..." } }, null, 2),
    },
  ],
  users: [
    {
      method: "GET",
      path: "/users/me",
      auth: "Both",
      description: "Get current authenticated user with wallet",
      response: JSON.stringify({ success: true, data: { id: "uuid", email: "user@example.com", wallet: { usdtBalance: 100, tokenBalance: 50 } } }, null, 2),
    },
    {
      method: "GET",
      path: "/users",
      auth: "Admin",
      description: "List all users (admin only)",
      query: "?page=1&limit=20&role=user&search=email",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", email: "user@example.com" }], meta: { page: 1, limit: 20, total: 100 } }, null, 2),
    },
    {
      method: "PATCH",
      path: "/users/:id/role",
      auth: "Admin",
      description: "Update user role (admin only)",
      request: JSON.stringify({ role: "admin" }, null, 2),
    },
    {
      method: "PATCH",
      path: "/users/:id",
      auth: "Admin",
      description: "Update user flags (showcasePaperTrades, suspended)",
      request: JSON.stringify({ showcasePaperTrades: true, suspended: false }, null, 2),
    },
  ],
  "api-keys": [
    {
      method: "GET",
      path: "/api-keys",
      auth: "JWT",
      description: "List your API keys (masked)",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", name: "Claude Desktop", keyPrefix: "nb_abc12345", lastUsedAt: "2024-01-01", permissions: ["bots:read", "bots:write"] }] }, null, 2),
    },
    {
      method: "POST",
      path: "/api-keys",
      auth: "JWT",
      description: "Generate a new API key (shown ONCE)",
      request: JSON.stringify({ name: "Claude Desktop", permissions: ["bots:read", "bots:write"], expiresAt: null }, null, 2),
      response: JSON.stringify({ success: true, data: { apiKey: "nb_abc12345_xyz...", name: "Claude Desktop", prefix: "nb_abc12345", warning: "This key is shown only once. Store it securely." } }, null, 2),
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
  bots: [
    {
      method: "GET",
      path: "/bots",
      auth: "Both",
      description: "List your bots",
      query: "?status=running",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", name: "BTC DCA", type: "dca", status: "running", mode: "paper", tradingPair: "BTC/USDT" }] }, null, 2),
    },
    {
      method: "POST",
      path: "/bots",
      auth: "Both",
      description: "Create a new trading bot",
      request: JSON.stringify({ name: "BTC DCA", connectionId: "uuid", tradingPair: "BTC/USDT", mode: "paper", paperInitialBalance: 1000, config: { type: "dca", base_order_volume: 10, safety_order_volume: 5, max_safety_orders: 5, price_deviation: 1.0, leverage: 1, leverage_type: "cross", take_profit: 2 } }, null, 2),
      response: JSON.stringify({ success: true, data: { id: "uuid", name: "BTC DCA", status: "stopped", mode: "paper" } }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id",
      auth: "Both",
      description: "Get bot details",
      response: JSON.stringify({ success: true, data: { id: "uuid", name: "BTC DCA", type: "dca", status: "running", configJson: {} } }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id/orders",
      auth: "Both",
      description: "Get bot orders",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", side: "buy", amount: 0.01, price: 50000, status: "filled" }] }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/:id/logs",
      auth: "Both",
      description: "Get bot logs",
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
      description: "Get current price for bot's trading pair",
      response: JSON.stringify({ success: true, data: { symbol: "BTC/USDT", last: 50000, bid: 49999, ask: 50001 } }, null, 2),
    },
    {
      method: "PATCH",
      path: "/bots/:id",
      auth: "Both",
      description: "Update bot name or config",
      request: JSON.stringify({ name: "Updated Name", configJson: { type: "dca", base_order_volume: 20 } }, null, 2),
    },
    {
      method: "POST",
      path: "/bots/:id/start",
      auth: "Both",
      description: "Start a bot",
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
      description: "Emergency exit — close all positions",
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
      description: "Toggle paper/live mode (bot must be stopped)",
      request: JSON.stringify({ mode: "live" }, null, 2),
      response: JSON.stringify({ success: true, data: { mode: "live" } }, null, 2),
    },
    {
      method: "DELETE",
      path: "/bots/:id",
      auth: "Both",
      description: "Delete a bot",
      response: JSON.stringify({ success: true }, null, 2),
    },
    {
      method: "GET",
      path: "/bots/admin/all",
      auth: "Admin",
      description: "List all bots across all users (admin only)",
      query: "?status=running",
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
      description: "Add a new exchange connection",
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
      description: "List available markets on exchange",
      query: "?quote=USDT",
      response: JSON.stringify({ success: true, data: [{ symbol: "BTC/USDT", base: "BTC", quote: "USDT" }] }, null, 2),
    },
    {
      method: "GET",
      path: "/exchange-connections/:id/balance",
      auth: "Both",
      description: "Get exchange wallet balance",
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
  wallets: [
    {
      method: "GET",
      path: "/wallets/me",
      auth: "Both",
      description: "Get your wallet",
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
      response: JSON.stringify({ success: true, data: [{ id: "uuid", type: "deposit", amount: 100, currency: "USDT", status: "confirmed" }] }, null, 2),
    },
  ],
  referrals: [
    {
      method: "GET",
      path: "/referrals/me",
      auth: "JWT",
      description: "Get referral stats and history",
      response: JSON.stringify({ success: true, data: { referralCode: "REF-ABC123", myReferrals: [], totalEarnings: 0, referralTokenBalance: 0 } }, null, 2),
    },
    {
      method: "POST",
      path: "/referrals/withdraw",
      auth: "JWT",
      description: "Request Reward Token withdrawal to USDT",
      request: JSON.stringify({ amount: 100 }, null, 2),
      response: JSON.stringify({ success: true, data: { message: "Withdrawal request submitted for admin approval" } }, null, 2),
    },
    {
      method: "GET",
      path: "/referrals/withdrawals",
      auth: "JWT",
      description: "List your withdrawal requests",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", amount: 100, status: "pending", requestedAt: "2024-01-01T00:00:00Z" }] }, null, 2),
    },
  ],
  logs: [
    {
      method: "GET",
      path: "/logs/activity",
      auth: "JWT",
      description: "Query bot logs with filters",
      query: "?botId=uuid&category=state&level=info&limit=100&offset=0",
      response: JSON.stringify({ success: true, data: [{ id: "uuid", level: "info", message: "Bot started" }], meta: { total: 50, limit: 100, offset: 0 } }, null, 2),
    },
    {
      method: "GET",
      path: "/logs/stream",
      auth: "JWT",
      description: "SSE real-time log stream",
      query: "?botId=uuid&category=order",
      response: "event: connected\ndata: {\"ok\":true}\n\nevent: log\ndata: {\"id\":\"uuid\",\"message\":\"Order filled\"}\n\n",
    },
  ],
  rankings: [
    {
      method: "GET",
      path: "/rankings",
      auth: "JWT",
      description: "Get trader leaderboard",
      query: "?period=weekly&limit=50",
      response: JSON.stringify({ success: true, data: [{ rank: 1, userId: "uuid", email: "a@b.com", score: 5000, tier: "S" }], meta: { period: "weekly", limit: 50, total: 100 } }, null, 2),
    },
  ],
  admin: [
    {
      method: "GET",
      path: "/admin/stats",
      auth: "Admin",
      description: "Platform overview stats",
    },
    {
      method: "GET",
      path: "/admin/users",
      auth: "Admin",
      description: "List users with pagination",
      query: "?page=1&limit=20&search=email",
    },
    {
      method: "GET",
      path: "/admin/bots",
      auth: "Admin",
      description: "List all bots",
      query: "?status=running",
    },
    {
      method: "GET",
      path: "/admin/logs",
      auth: "Admin",
      description: "View system logs",
      query: "?level=error&limit=100",
    },
    {
      method: "GET",
      path: "/admin/withdrawals",
      auth: "Admin",
      description: "List pending withdrawal requests",
    },
    {
      method: "POST",
      path: "/admin/withdrawals/:id/approve",
      auth: "Admin",
      description: "Approve a withdrawal request",
      response: JSON.stringify({ success: true, data: { id: "uuid", status: "approved" } }, null, 2),
    },
    {
      method: "POST",
      path: "/admin/withdrawals/:id/reject",
      auth: "Admin",
      description: "Reject a withdrawal request",
      response: JSON.stringify({ success: true, data: { id: "uuid", status: "rejected" } }, null, 2),
    },
  ],
  health: [
    {
      method: "GET",
      path: "/health",
      auth: "JWT",
      description: "Health check",
      response: JSON.stringify({ success: true, data: "ok" }, null, 2),
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
    Admin: "bg-[var(--danger)]/10 text-[var(--danger)]",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[auth] || ""}`}>
      {auth}
    </span>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
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
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Query Parameters</div>
          <code className="text-[11px] font-mono text-[var(--accent)]">{ep.query}</code>
        </div>
      )}

      {ep.request && (
        <div className="mb-3 relative">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Request Body</div>
          <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)] relative">
            {ep.request}
            <CopyButton text={ep.request} />
          </pre>
        </div>
      )}

      {ep.response && (
        <div className="mb-3 relative">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">Response</div>
          <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)] relative">
            {ep.response}
            <CopyButton text={ep.response} />
          </pre>
        </div>
      )}

      <div className="relative">
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">cURL Example</div>
        <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)] whitespace-pre-wrap break-all relative">
          {curl}
          <CopyButton text={curl.replace(/\\\n/g, "\n")} />
        </pre>
      </div>
    </div>
  );
}

function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("auth");
  const [showApiKey, setShowApiKey] = useState(false);

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
          to="/profile"
          className="p-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            API Documentation
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            REST API reference for integrating with NexusBot
          </p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="hidden lg:block w-[200px] shrink-0 sticky top-4">
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
                  <span className="truncate">{s.label}</span>
                  <ChevronRight className={`w-3 h-3 ml-auto shrink-0 transition-transform ${activeSection === s.id ? "rotate-90" : ""}`} />
                </button>
              );
            })}
          </div>

          <div className="mt-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Base URL</span>
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
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Auth intro always visible at top */}
          <div id="section-auth" className="scroll-mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">Authentication</h2>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                The API supports two authentication methods. Most endpoints accept either, but some (like API key management) require JWT.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
                <div className="bg-[var(--bg-card)] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold mb-1">JWT Bearer Token</div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-2">Used by the web app. Obtained from <code className="text-[var(--accent)]">/auth/login</code>.</p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-2 overflow-x-auto border border-[var(--border-subtle)]">
                      Authorization: Bearer &lt;token&gt;
                      <CopyButton text="Authorization: Bearer <token>" />
                    </pre>
                  </div>
                </div>
                <div className="bg-[var(--bg-card)] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold mb-1">API Key</div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-2">Long-lived keys for AI agents and scripts. Created on the <Link to="/ai-integration" className="text-[var(--primary)] hover:underline">AI Integration</Link> page.</p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-2 overflow-x-auto border border-[var(--border-subtle)]">
                      X-API-Key: nb_abc123_xxx...
                      <CopyButton text="X-API-Key: nb_abc123_xxx..." />
                    </pre>
                  </div>
                </div>
              </div>
            </div>
            {ENDPOINTS.auth.map((ep, i) => (
              <EndpointCard key={i} ep={ep} />
            ))}
          </div>

          {SECTIONS.filter((s) => s.id !== "auth").map((section) => (
            <div key={section.id} id={`section-${section.id}`} className="scroll-mt-4">
              <div className="flex items-center gap-2 mb-4">
                <section.icon className="w-4 h-4 text-[var(--primary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">{section.label}</h2>
              </div>
              {ENDPOINTS[section.id]?.map((ep, i) => (
                <EndpointCard key={i} ep={ep} />
              )) || (
                <p className="text-xs text-[var(--text-muted)]">Documentation coming soon.</p>
              )}
            </div>
          ))}

          {/* Footer note */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 text-center">
            <p className="text-[11px] text-[var(--text-muted)]">
              For MCP / AI Agent integration, see the{" "}
              <Link to="/ai-integration" className="text-[var(--primary)] hover:underline font-medium">
                AI Integration page
              </Link>{" "}
              or read the{" "}
              <a href="https://github.com/longsyee/crypto-bot-platform/blob/master/docs/MCP_INTEGRATION.md" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline font-medium">
                MCP Integration Guide
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
