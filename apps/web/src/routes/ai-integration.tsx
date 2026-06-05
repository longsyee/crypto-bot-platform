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
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useMe } from "../hooks/use-api";

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
  const [showKey, setShowKey] = useState(true);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [defaultMode, setDefaultMode] = useState<"paper" | "live">(() => {
    return (localStorage.getItem("ai_default_mode") as "paper" | "live") || "paper";
  });
  const [activeTab, setActiveTab] = useState<"keys" | "setup" | "docs">("keys");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const { data: meData } = useMe();
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
    const payload: any = { name: newKeyName.trim() };
    if (expiresInDays) payload.expiresInDays = expiresInDays;
    if (meData?.totpEnabled && totpCode.trim()) payload.totpCode = totpCode.trim();
    createKey.mutate(payload, {
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
      onError: (err: any) => {
        const msg = err?.response?.data?.error || err?.message || t("common.error");
        toast.error(msg);
      },
    });
  }, [createKey, newKeyName, expiresInDays, totpCode, meData?.totpEnabled, toast, t]);

  const openModal = useCallback(() => {
    setShowKeyModal(true);
    setCreatedKey("<null>");
    setNewKeyName("");
    setJustCopied(false);
    setShowKey(true);
    setExpiresInDays(null);
    setTotpCode("");
  }, []);

  const closeModal = useCallback(() => {
    setShowKeyModal(false);
    setCreatedKey("<null>");
    setNewKeyName("");
    setJustCopied(false);
    setShowKey(true);
    setExpiresInDays(null);
    setTotpCode("");
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
              {defaultMode === "paper" ? t("aiIntegration.defaultModePaper") : t("aiIntegration.defaultModeLive")}
            </span>
            <button
              onClick={() => setDefaultMode((m) => (m === "paper" ? "live" : "paper"))}
              className="px-2 py-1 rounded-md text-[11px] font-medium border transition-colors"
              style={{
                borderColor: defaultMode === "paper" ? "var(--primary)" : "var(--danger)",
                color: defaultMode === "paper" ? "var(--primary)" : "var(--danger)",
              }}
            >
              {defaultMode === "paper" ? t("aiIntegration.switchToLive") : t("aiIntegration.switchToPaper")}
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
            {defaultMode === "paper"
              ? t("aiIntegration.paperModeDesc")
              : t("aiIntegration.liveModeDesc")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden mb-5 w-fit">
        {[
          { id: "keys" as const, labelKey: "aiIntegration.tabKeys" as const, icon: <Key className="w-3.5 h-3.5" /> },
          { id: "setup" as const, labelKey: "aiIntegration.tabSetup" as const, icon: <Terminal className="w-3.5 h-3.5" /> },
          { id: "docs" as const, labelKey: "aiIntegration.tabDocs" as const, icon: <BookOpen className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.icon}
            {t(tab.labelKey)}
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
              {t("aiIntegration.newKey")}
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
                <div key={k.id} className="bg-[var(--bg-card)] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{k.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                      {k.keyPrefix}•••••••• {k.lastUsedAt ? `${t("aiIntegration.lastUsed")} ${new Date(k.lastUsedAt).toLocaleDateString()}` : t("aiIntegration.neverUsed")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(k.keyPrefix);
                        setCopiedKeyId(k.id);
                        toast.success(t("aiIntegration.copied"));
                        setTimeout(() => setCopiedKeyId((prev) => prev === k.id ? null : prev), 1500);
                      }}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                      title={t("aiIntegration.copyPrefix")}
                    >
                      {copiedKeyId === k.id ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => revokeKey.mutate(k.id)}
                      disabled={revokeKey.isPending}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                      title={t("aiIntegration.revoke")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{t("aiIntegration.claudeDesktop")}</span>
            </div>
            <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border border-[var(--border-subtle)]">
{mcpConfig}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(mcpConfig);
                toast.success(t("aiIntegration.claudeConfigCopied"));
              }}
              className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Copy className="w-3 h-3" />
              {t("aiIntegration.copyConfig")}
            </button>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{t("aiIntegration.clineCursor")}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t("aiIntegration.clineCursorDesc")}
            </p>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-[var(--success)]" />
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{t("aiIntegration.configFileAlt")}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t("aiIntegration.configFileAltDesc")}
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
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-3">{t("aiIntegration.quickStartGuide")}</h3>
            <ol className="space-y-3 text-xs text-[var(--text-secondary)] list-decimal list-inside">
              <li>{t("aiIntegration.step1")}</li>
              <li>{t("aiIntegration.step2")}</li>
              <li>{t("aiIntegration.step3")}</li>
              <li>{t("aiIntegration.step4")}</li>
            </ol>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-3">{t("aiIntegration.paperVsLiveTitle")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--primary)]">
                <div className="text-[10px] uppercase tracking-widest text-[var(--primary)] font-semibold mb-1">{t("aiIntegration.paperTradingCard")}</div>
                <ul className="text-[11px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
                  <li>{t("aiIntegration.paperBullet1")}</li>
                  <li>{t("aiIntegration.paperBullet2")}</li>
                  <li>{t("aiIntegration.paperBullet3")}</li>
                  <li>{t("aiIntegration.paperBullet4")}</li>
                </ul>
              </div>
              <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--danger)]">
                <div className="text-[10px] uppercase tracking-widest text-[var(--danger)] font-semibold mb-1">{t("aiIntegration.liveTradingCard")}</div>
                <ul className="text-[11px] text-[var(--text-muted)] space-y-1 list-disc list-inside">
                  <li>{t("aiIntegration.liveBullet1")}</li>
                  <li>{t("aiIntegration.liveBullet2")}</li>
                  <li>{t("aiIntegration.liveBullet3")}</li>
                  <li>{t("aiIntegration.liveBullet4")}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--success)]" />
              {t("aiIntegration.securityChecklist")}
            </h3>
            <ul className="space-y-2">
              {[
                t("aiIntegration.checklist1"),
                t("aiIntegration.checklist2"),
                t("aiIntegration.checklist3"),
                t("aiIntegration.checklist4"),
                t("aiIntegration.checklist5"),
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
              {t("aiIntegration.restApiDocs")}
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
              {t("aiIntegration.mcpGuideGithub")}
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
                    value={showKey ? createdKey : "•".repeat(createdKey.length)}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    rows={3}
                    className="w-full px-3 py-2 pr-16 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--primary)] resize-none break-all"
                  />
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    <button
                      onClick={() => setShowKey((s) => !s)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      title={showKey ? t("aiIntegration.hideKey") : t("aiIntegration.showKey")}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleCopyKey(createdKey)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      title={t("common.copy")}
                    >
                      {justCopied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
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

                {/* Expiry selector */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("aiIntegration.expiresIn")}</label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <select
                      value={expiresInDays ?? ""}
                      onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
                      className="flex-1 px-3 py-2 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">{t("aiIntegration.expiresNever")}</option>
                      <option value={30}>30 {t("aiIntegration.days")}</option>
                      <option value={90}>90 {t("aiIntegration.days")}</option>
                      <option value={180}>180 {t("aiIntegration.days")}</option>
                    </select>
                  </div>
                </div>

                {/* 2FA input when enabled */}
                {meData?.totpEnabled && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("aiIntegration.totpCode")}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder={t("aiIntegration.totpPlaceholder")}
                      className="w-full px-3 py-2 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] text-center tracking-[0.3em] font-mono"
                      onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{t("aiIntegration.totpHint")}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={createKey.isPending || !newKeyName.trim() || (meData?.totpEnabled && totpCode.length !== 6)}
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
