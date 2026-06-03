import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import {
  ArrowLeft,
  Bell,
  Moon,
  Globe,
  Shield,
  ChevronRight,
  Save,
  Check,
  Key,
  Copy,
  Terminal,
  Zap,
  Trash2,
  Plus,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "../hooks/use-theme";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "../hooks/use-api";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuth((s) => s.user);
  const toast = useToast();
  const { theme, toggle } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [lang, setLang] = useState("en");
  const [saving, setSaving] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("<null>");
  const [showKey, setShowKey] = useState(false);

  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Preferences saved");
    }, 600);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/dashboard"
          className="p-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pressed)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Manage your preferences</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Appearance */}
        <SettingsSection title="Appearance" icon={<Moon className="w-4 h-4" />}>
          <ToggleRow
            label="Dark Mode"
            description="Use dark theme across the platform"
            enabled={theme === "dark"}
            onChange={toggle}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications" icon={<Bell className="w-4 h-4" />}>
          <ToggleRow
            label="Push Notifications"
            description="Receive alerts for trades, deposits, and system events"
            enabled={notifications}
            onChange={setNotifications}
          />
        </SettingsSection>

        {/* Language */}
        <SettingsSection title="Language & Region" icon={<Globe className="w-4 h-4" />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { code: "en", label: "English" },
              { code: "zh", label: "中文" },
              { code: "ms", label: "Bahasa" },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${
                  lang === l.code
                    ? "bg-[var(--primary-glow)] border-[var(--primary)]/20 text-[var(--primary)]"
                    : "bg-[var(--bg-hover)]/50 border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {l.label}
                {lang === l.code && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Security */}
        <SettingsSection title="Security" icon={<Shield className="w-4 h-4" />}>
          <div className="space-y-1">
            <LinkButton label="Change Password" to="/forgot-password" />
            <LinkButton label="Two-Factor Authentication" to="#" />
            <LinkButton label="Active Sessions" to="#" />
          </div>
        </SettingsSection>

        {/* API Keys */}
        <SettingsSection title="API Keys" icon={<Key className="w-4 h-4" />}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--text-muted)]">
                Long-lived keys for AI agents, scripts, and third-party integrations.
              </div>
              <button
                onClick={() => { setShowKeyModal(true); setCreatedKey("<null>"); setNewKeyName(""); }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-[var(--primary)] text-[var(--text-invert)] font-medium hover:brightness-110 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Key
              </button>
            </div>

            {keysLoading ? (
              <p className="text-xs text-[var(--text-muted)]">Loading keys...</p>
            ) : !apiKeys?.data?.length ? (
              <p className="text-xs text-[var(--text-muted)]">No API keys yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
                {apiKeys.data.map((k: any) => (
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
        </SettingsSection>

        {/* AI Agent / MCP Integration */}
        <SettingsSection title="AI Agent Integration" icon={<Terminal className="w-4 h-4" />}>
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Connect Claude Desktop, Cursor, Cline, or any MCP-compatible AI agent to manage bots and trade via natural language.
            </p>

            <div className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Claude Desktop Config</span>
              </div>
              <pre className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">
{JSON.stringify({
  mcpServers: {
    nexusbot: {
      command: "npx",
      args: ["-y", "@crypto-bot-platform/mcp-server"],
      env: {
        NEXUSBOT_API_URL: window.location.origin.replace("5173","3010").replace("4173","3010"),
        NEXUSBOT_API_KEY: "YOUR_API_KEY_HERE"
      }
    }
  }
}, null, 2)}
              </pre>
              <button
                onClick={() => {
                  const config = JSON.stringify({
                    mcpServers: {
                      nexusbot: {
                        command: "npx",
                        args: ["-y", "@crypto-bot-platform/mcp-server"],
                        env: {
                          NEXUSBOT_API_URL: window.location.origin.replace("5173","3010").replace("4173","3010"),
                          NEXUSBOT_API_KEY: "YOUR_API_KEY_HERE"
                        }
                      }
                    }
                  }, null, 2);
                  navigator.clipboard.writeText(config);
                  toast.success("Config copied to clipboard");
                }}
                className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy Config
              </button>
            </div>
          </div>
        </SettingsSection>

        {/* Account Info */}
        <SettingsSection title="Account" icon={<Shield className="w-4 h-4" />}>
          <div className="space-y-3">
            <InfoRow label="Email" value={user?.email || "—"} />
            <InfoRow label="Role" value={user?.role || "user"} />
            <InfoRow label="User ID" value={user?.id || "—"} />
          </div>
        </SettingsSection>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--text-invert)] font-medium text-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--text-invert)]/30 border-t-[var(--text-invert)] rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Create API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight">Generate API Key</h3>
              <button onClick={() => setShowKeyModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdKey !== "<null>" ? (
              <div className="space-y-3">
                <div className="bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg p-3">
                  <p className="text-xs text-[var(--success)] font-medium mb-1">Key created successfully</p>
                  <p className="text-[10px] text-[var(--text-muted)]">This is the only time you will see the full key. Store it securely.</p>
                </div>
                <div className="flex items-center gap-2 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg p-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={createdKey}
                    readOnly
                    className="flex-1 bg-transparent text-xs font-mono text-[var(--text-primary)] outline-none"
                  />
                  <button onClick={() => setShowKey((v) => !v)} className="text-[var(--text-muted)]">
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied"); }}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--text-invert)] text-xs font-medium hover:brightness-110"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Claude Desktop"
                    className="w-full px-3 py-2 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!newKeyName.trim()) return;
                    createKey.mutate(
                      { name: newKeyName.trim() },
                      {
                        onSuccess: (res) => {
                          if (res?.data?.apiKey) {
                            setCreatedKey(res.data.apiKey);
                            toast.success("API key generated");
                          }
                        },
                        onError: () => toast.error("Failed to generate key"),
                      }
                    );
                  }}
                  disabled={createKey.isPending || !newKeyName.trim()}
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--text-invert)] text-xs font-medium hover:brightness-110 disabled:opacity-50"
                >
                  {createKey.isPending ? "Generating..." : "Generate Key"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-5 flex items-center gap-2">
          <span className="text-[var(--primary)]">{icon}</span>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-[var(--text-primary)] font-medium">{label}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? "bg-[var(--primary)]" : "bg-[var(--bg-pressed)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--text-primary)] shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function LinkButton({ label, to }: { label: string; to: string }) {
  return (
    <a
      href={to}
      className="flex items-center justify-between py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border-b border-[var(--border-subtle)] last:border-0"
    >
      {label}
      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)] font-medium">{value}</span>
    </div>
  );
}
