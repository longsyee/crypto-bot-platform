import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "../hooks/use-toast";
import { useI18n } from "../hooks/use-i18n";
import {
  ArrowLeft,
  Key,
  Copy,
  Terminal,
  Zap,
  Trash2,
  Plus,
  X,
  Bot,
  BookOpen,
  Shield,
  AlertTriangle,
  Check,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "../hooks/use-api";

export const Route = createFileRoute("/ai-integration")({
  component: AiIntegrationPage,
});

const AI_DOCS_URL = "https://github.com/longsyee/crypto-bot-platform/blob/master/docs/MCP_INTEGRATION.md";

function AiIntegrationPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("<null>");
  const [justCopied, setJustCopied] = useState(false);
  const [defaultMode, setDefaultMode] = useState<"paper" | "live">(() => {
    return (localStorage.getItem("ai_default_mode") as "paper" | "live") || "paper";
  });
  const [activeTab, setActiveTab] = useState<"keys" | "setup" | "docs">("keys");

  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  useEffect(() => {
    localStorage.setItem("ai_default_mode", defaultMode);
  }, [defaultMode]);

  const apiBaseUrl = typeof window !== "undefined"
    ? window.location.origin.replace(":5173", ":3010").replace(":4173", ":3010")
    : "http://localhost:3010";

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        nexusbot: {
          command: "npx",
          args: ["-y", "@crypto-bot-platform/mcp-server"],
          env: {
            NEXUSBOT_API_URL: apiBaseUrl,
            NEXUSBOT_API_KEY: "YOUR_API_KEY_HERE",
          },
        },
      },
    },
    null,
    2
  );

  const handleCopyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    setJustCopied(true);
    toast.success(t("aiIntegration.copied"));
    setTimeout(() => setJustCopied(false), 2000);
  }, [toast, t]);

  const handleGenerate = useCallback(() => {
    if (!newKeyName.trim()) return;
    createKey.mutate(
      { name: newKeyName.trim() },
      {
        onSuccess: (res) => {
          if (res?.data?.apiKey) {
            const key = res.data.apiKey;
            setCreatedKey(key);
            navigator.clipboard.writeText(key);
            toast.success(t("aiIntegration.copied"));
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
          }
        },
        onError: () => toast.error(t("common.error")),
      }
    );
  }, [createKey, newKeyName, toast, t]);

  const openModal = useCallback(() => {
    setShowKeyModal(true);
    setCreatedKey("<null>");
    setNewKeyName("");
    setJustCopied(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowKeyModal(false);
    setCreatedKey("<null>");
    setNewKeyName("");
    setJustCopied(false);
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
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
            {t("aiIntegration.title")}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">{t("aiIntegration.subtitle")}</p>
        </div>
      </div>

      {/* Mode Banner */}
      <div className={`mb-5 rounded-xl border p-3 flex items-start gap-3 ${
        defaultMode === "paper"
          ? "bg-[var(--primary)]/5 border-[var(--primary)]/20"
          : "bg-[var(--danger)]/5 border-[var(--danger)]/20"
      }`}>
        <div className={`mt-0.5 shrink-0 ${defaultMode === "paper" ? "text-[var(--primary)]" : "text-[var(--danger)]"}`}>
          {defaultMode === "paper" ? <Bot className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Default AI Trading Mode: <strong>{defaultMode === "paper" ? "Paper Trading" : "Live Trading"}</strong>
            </span>
            <button
              onClick={() => setDefaultMode((m) => (m === "paper" ? "live" : "paper"))}
              className="px-2 py-1 rounded-md text-[11px] font-medium border transition-colors"
              style={{
                borderColor: defaultMode === "paper" ? "var(--primary)" : "var(--danger)",
                color: defaultMode === "paper" ? "var(--primary)" : "var(--danger)",
              }}
            >
              Switch to {defaultMode === "paper" ? "Live" : "Paper"}
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
            {defaultMode === "paper"
              ? "AI agents will create bots in Paper Trading mode by default. No real funds are used. Perfect for testing strategies safely."
              : "AI agents will create bots in Live Trading mode by default. Real funds on real exchanges will be used. Ensure your exchange connections are active and API keys are correct."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden mb-5 w-fit">
        {[
          { id: "keys", label: "API Keys", icon: <Key className="w-3.5 h-3.5" /> },
          { id: "setup", label: "MCP Setup", icon: <Terminal className="w-3.5 h-3.5" /> },
          { id: "docs", label: "Docs & Safety", icon: <BookOpen className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- API Keys Tab --- */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">{t("aiIntegration.apiKeysTitle")}</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t("aiIntegration.apiKeysDesc")}</p>
            </div>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-[var(--primary)] text-[var(--text-invert)] font-medium hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Key
            </button>
          </div>

          {keysLoading ? (
            <p className="text-xs text-[var(--text-muted)]">{t("common.loading")}...</p>
          ) : !apiKeys?.length ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 text-center">
              <Key className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--text-muted)]">{t("aiIntegration.noKeys")}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{t("aiIntegration.noKeysDesc")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
              {apiKeys.map((k: any) => (
                <div key={k.id} className="bg-[var(--bg-card)] p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{k.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                      {k.keyPrefix}•••••••• {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKey.mutate(k.id)}
                    disabled={revokeKey.isPending}
                    className="px-2 py-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    title="Revoke"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- MCP Setup Tab --- */}
      {activeTab === "setup" && (
        <div className="space-y-5">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Claude Desktop</span>
            </div>
            <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border border-[var(--border-subtle)]">
{mcpConfig}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(mcpConfig);
                toast.success("Claude config copied");
              }}
              className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy Config
            </button>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Cline / Cursor</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Use the same JSON config above in your Cline or Cursor MCP settings. Replace <code className="font-mono text-[var(--accent)]">YOUR_API_KEY_HERE</code> with a key from the API Keys tab.
            </p>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-[var(--success)]" />
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Config File (Alternative)</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Instead of embedding the key in each client config, create <code className="font-mono text-[var(--accent)]">~/.nexusbot/mcp-config.json</code>:
            </p>
            <pre className="mt-2 text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)]">
{JSON.stringify({ apiBaseUrl, apiKey: "nb_xxxxx_xxxxx" }, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* --- Docs Tab --- */}
      {activeTab === "docs" && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-3">Quick Start Guide</h3>
            <ol className="space-y-3 text-xs text-[var(--text-secondary)] list-decimal list-inside">
              <li>
                <strong className="text-[var(--text-primary)]">Generate an API Key</strong> — Go to the API Keys tab, click New Key, name it (e.g. "Claude Desktop"), and copy it immediately. It is shown only once.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Set Default Mode</strong> — Keep it on Paper Trading while testing strategies. Switch to Live only when ready.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Configure Your AI Client</strong> — Copy the MCP config from the Setup tab into Claude Desktop, Cline, or Cursor.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Start Chatting</strong> — Try: <em>"List my bots"</em>, <em>"Create a DCA bot for BTC/USDT"</em>, or <em>"Send a BUY signal to my signal bot"</em>.
              </li>
            </ol>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-3">Paper vs Live Trading</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--primary)]">
                <div className="text-[10px] uppercase tracking-widest text-[var(--primary)] font-semibold mb-1">Paper Trading</div>
                <ul className="text-[11px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
                  <li>Simulated orders, no real funds</li>
                  <li>Test strategies safely</li>
                  <li>No exchange balance required</li>
                  <li>Default for new AI bots</li>
                </ul>
              </div>
              <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--danger)]">
                <div className="text-[10px] uppercase tracking-widest text-[var(--danger)] font-semibold mb-1">Live Trading</div>
                <ul className="text-[11px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
                  <li>Real orders on real exchanges</li>
                  <li>Requires active exchange connection</li>
                  <li>Token balance checked on start</li>
                  <li>Use only after paper testing</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--success)]" />
              Security Checklist
            </h3>
            <ul className="space-y-2">
              {[
                "Generate a separate API key per AI agent",
                "Revoke keys you no longer use",
                "Start every new strategy in Paper Trading mode",
                "Verify exchange connections before Live trading",
                "Never paste your API key in public chats",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                  <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Link
            to="/api-docs"
            className="flex items-center justify-between bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors mb-3"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--accent)]" />
              REST API Documentation
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>

          <a
            href={AI_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[var(--accent)]" />
              MCP Integration Guide (GitHub)
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Create Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight">{t("aiIntegration.generateApiKey")}</h3>
              <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdKey !== "<null>" ? (
              <div className="space-y-3">
                <div className="bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg p-3">
                  <p className="text-xs text-[var(--success)] font-medium mb-1">{t("aiIntegration.keyCreated")}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{t("aiIntegration.keyCreatedDesc")}</p>
                </div>

                {/* Plain-text key display with auto-select */}
                <div className="relative">
                  <textarea
                    value={createdKey}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--primary)] resize-none break-all"
                  />
                  <button
                    onClick={() => handleCopyKey(createdKey)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    title={t("common.copy")}
                  >
                    {justCopied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Prominent copy button */}
                <button
                  onClick={() => handleCopyKey(createdKey)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-xs font-medium hover:bg-[var(--primary)]/20 transition-colors"
                >
                  {justCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {justCopied ? t("aiIntegration.copied") : t("aiIntegration.copyToClipboard")}
                </button>

                <button
                  onClick={closeModal}
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--text-invert)] text-xs font-medium hover:brightness-110"
                >
                  {t("aiIntegration.done")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("aiIntegration.keyName")}</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder={t("aiIntegration.keyNamePlaceholder")}
                    className="w-full px-3 py-2 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                    onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={createKey.isPending || !newKeyName.trim()}
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--text-invert)] text-xs font-medium hover:brightness-110 disabled:opacity-50"
                >
                  {createKey.isPending ? t("aiIntegration.generating") : t("aiIntegration.generateKey")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
