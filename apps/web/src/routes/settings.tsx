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
  Terminal,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "../hooks/use-theme";

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

        {/* AI Integration Link */}
        <Link
          to="/ai-integration"
          className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden block hover:border-[var(--primary)]/30 transition-colors"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
                  AI Agent Integration
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  API keys, MCP setup, and trading mode for Claude / Cursor / Cline
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </Link>

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
