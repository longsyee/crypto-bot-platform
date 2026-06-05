import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { useTheme } from "../hooks/use-theme";
import { useI18n } from "../hooks/use-i18n";
import { useMe, useSetup2FA, useVerify2FA, useDisable2FA } from "../hooks/use-api";
import { QRCodeSVG } from "qrcode.react";
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
  KeyRound,
  X,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuth((s) => s.user);
  const toast = useToast();
  const { theme, toggle } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { data: meData } = useMe();
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  // 2FA modal state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [qrData, setQrData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisablePw, setShowDisablePw] = useState(false);

  const setup2FA = useSetup2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();

  const is2FAEnabled = meData?.totpEnabled || false;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success(t("common.success"));
    }, 600);
  };

  const handleEnable2FA = async () => {
    setSetupStep(1);
    setTotpCode("");
    setShow2FAModal(true);
    try {
      const res = await setup2FA.mutateAsync();
      if (res) {
        setQrData(res);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to setup 2FA");
    }
  };

  const handleVerify2FA = async () => {
    if (totpCode.length !== 6) return;
    try {
      await verify2FA.mutateAsync(totpCode);
      toast.success(t("twoFA.successEnabled"));
      setShow2FAModal(false);
      setQrData(null);
      setTotpCode("");
    } catch (err: any) {
      toast.error(err?.message || t("twoFA.invalidCode"));
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) return;
    try {
      await disable2FA.mutateAsync(disablePassword);
      toast.success(t("twoFA.successDisabled"));
      setShowDisableModal(false);
      setDisablePassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to disable 2FA");
    }
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
            {t("settings.title")}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Appearance */}
        <SettingsSection title={t("settings.appearance")} icon={<Moon className="w-4 h-4" />}>
          <ToggleRow
            label={t("settings.darkMode")}
            description={t("settings.darkModeDesc")}
            enabled={theme === "dark"}
            onChange={toggle}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title={t("settings.notifications")} icon={<Bell className="w-4 h-4" />}>
          <ToggleRow
            label={t("settings.pushNotifications")}
            description={t("settings.pushNotificationsDesc")}
            enabled={notifications}
            onChange={setNotifications}
          />
        </SettingsSection>

        {/* Language */}
        <SettingsSection title={t("settings.languageRegion")} icon={<Globe className="w-4 h-4" />}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: "en", label: "English" },
              { code: "zh", label: "中文" },
              { code: "ms", label: "Bahasa Melayu" },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as any)}
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
        <SettingsSection title={t("settings.security")} icon={<Shield className="w-4 h-4" />}>
          <div className="space-y-1">
            <LinkButton label={t("settings.changePassword")} to="/forgot-password" />
            <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">{t("settings.twoFactorAuth")}</span>
                {is2FAEnabled ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--success)]/10 text-[var(--success)]">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("twoFA.statusEnabled")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--text-muted)]/10 text-[var(--text-muted)]">
                    <AlertCircle className="w-3 h-3" />
                    {t("twoFA.statusDisabled")}
                  </span>
                )}
              </div>
              <button
                onClick={is2FAEnabled ? () => setShowDisableModal(true) : handleEnable2FA}
                disabled={setup2FA.isPending}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  is2FAEnabled
                    ? "bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20"
                    : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20"
                }`}
              >
                {setup2FA.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : is2FAEnabled ? (
                  t("twoFA.disableBtn")
                ) : (
                  t("twoFA.enableBtn")
                )}
              </button>
            </div>
            <LinkButton label={t("settings.activeSessions")} to="#" />
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
                  {t("settings.aiIntegration")}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t("settings.aiIntegrationDesc")}</p>
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
                {t("common.loading")}...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t("settings.save")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight text-[var(--text-primary)]">{t("twoFA.setupTitle")}</h3>
              </div>
              <button
                onClick={() => { setShow2FAModal(false); setQrData(null); setTotpCode(""); }}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-5 mt-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  setupStep >= 1 ? "bg-[var(--primary)] text-[var(--text-invert)]" : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                }`}>1</span>
                <span className={`text-[11px] font-medium ${setupStep >= 1 ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>Scan</span>
              </div>
              <div className="flex-1 h-px bg-[var(--border-subtle)] relative">
                <div className={`absolute inset-y-0 left-0 bg-[var(--primary)] transition-all duration-300 ${
                  setupStep >= 2 ? "w-full" : "w-0"
                }`} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  setupStep >= 2 ? "bg-[var(--primary)] text-[var(--text-invert)]" : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                }`}>2</span>
                <span className={`text-[11px] font-medium ${setupStep >= 2 ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>Verify</span>
              </div>
            </div>

            {setupStep === 1 && qrData ? (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    Scan with your authenticator app
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    {t("twoFA.setupStep1")}
                  </p>
                </div>

                {/* QR Card */}
                <div className="bg-white rounded-xl p-4 border border-[var(--border-subtle)] shadow-sm flex justify-center">
                  <QRCodeSVG value={qrData.otpauthUrl} size={192} />
                </div>

                {/* Secret Key */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{t("twoFA.secretLabel")}</label>
                  <div className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg p-2.5 flex items-center gap-2 group hover:border-[var(--primary)]/30 transition-colors">
                    <input
                      type="text"
                      value={qrData.secret}
                      readOnly
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 bg-transparent text-xs font-mono text-[var(--text-primary)] outline-none tracking-wider"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(qrData.secret);
                        toast.success(t("common.copy"));
                      }}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                      title={t("common.copy")}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Can&apos;t scan? Enter this code manually into your app.
                  </p>
                </div>

                <button
                  onClick={() => setSetupStep(2)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--text-invert)] text-xs font-semibold hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {t("common.next") || "Next"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : setupStep === 2 ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] mx-auto mb-3">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    Enter verification code
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    {t("twoFA.setupStep2")}
                  </p>
                </div>

                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-lg text-[var(--text-primary)] text-center tracking-[0.75em] font-mono font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  maxLength={6}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setSetupStep(1)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {t("common.back") || "Back"}
                  </button>
                  <button
                    onClick={handleVerify2FA}
                    disabled={totpCode.length !== 6 || verify2FA.isPending}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--text-invert)] text-xs font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {verify2FA.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("common.verifying")}...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("twoFA.verifyBtn")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="relative w-10 h-10 mx-auto mb-3">
                  <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
                  <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] absolute inset-0" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">{t("common.loading")}...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2FA Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight">{t("twoFA.disableTitle")}</h3>
              <button
                onClick={() => { setShowDisableModal(false); setDisablePassword(""); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">{t("twoFA.disableDesc")}</p>
            <div className="relative mb-4">
              <input
                type={showDisablePw ? "text" : "password"}
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={t("twoFA.passwordPlaceholder")}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDisablePw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              >
                {showDisablePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDisableModal(false); setDisablePassword(""); }}
                className="flex-1 px-3 py-2 rounded-md border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDisable2FA}
                disabled={!disablePassword || disable2FA.isPending}
                className="flex-1 px-3 py-2 rounded-md bg-[var(--danger)] text-[var(--text-invert)] text-xs font-medium hover:brightness-110 disabled:opacity-50"
              >
                {disable2FA.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  t("twoFA.confirmDisable")
                )}
              </button>
            </div>
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
