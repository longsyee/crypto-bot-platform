import { useRef, useState, useEffect } from "react";
import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "../hooks/use-auth";
import { api } from "../lib/api-client";
import { useToast } from "../hooks/use-toast";
import { useI18n } from "../hooks/use-i18n";
import { useLogin2FA } from "../hooks/use-api";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Bot,
  Zap,
  Shield,
  TrendingUp,
  Loader2,
  KeyRound,
} from "lucide-react";
import { AuthBackground } from "../components/auth/auth-background";
import { SpotlightCard } from "../components/auth/spotlight-card";
import { ParticleCanvas } from "../components/auth/particle-canvas";
import gsap from "gsap";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function FeatureItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
      <span className="w-8 h-8 rounded-lg bg-[var(--text-invert)]/[0.04] border border-[var(--text-invert)]/[0.08] flex items-center justify-center text-[var(--accent)]">
        {icon}
      </span>
      {label}
    </div>
  );
}

type Step = "credentials" | "2fa";

function LoginPage() {
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useI18n();
  const login2FA = useLogin2FA();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [step, setStep] = useState<Step>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    if (!contentRef.current) return;
    const els = contentRef.current.querySelectorAll(".reveal");
    gsap.fromTo(
      els,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.2 }
    );
  }, [step]);

  function shakeCard() {
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove("auth-shake");
    void card.offsetWidth;
    card.classList.add("auth-shake");
    gsap.fromTo(card, { x: -4 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "2fa") {
      await handleVerify2FA();
      return;
    }

    setErrors({});
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = t("auth.emailRequired");
    if (!password) nextErrors.password = t("auth.passwordRequired");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      shakeCard();
      return;
    }

    setIsLoading(true);
    try {
      const data = await api<{
        mfaRequired?: boolean;
        tempToken?: string;
        accessToken?: string;
        refreshToken?: string;
        user?: any;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (data.mfaRequired && data.tempToken) {
        setTempToken(data.tempToken);
        setStep("2fa");
        return;
      }

      setAuth(data.accessToken!, data.refreshToken!, data.user!);
      if (rememberMe) localStorage.setItem("rememberEmail", email);
      else localStorage.removeItem("rememberEmail");
      toast.success(t("auth.welcomeBack"));
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || t("auth.loginFailed"));
      shakeCard();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify2FA() {
    if (totpCode.length !== 6) return;
    try {
      const data = await login2FA.mutateAsync({ code: totpCode, tempToken });
      setAuth(data.accessToken, data.refreshToken, data.user);
      toast.success(t("auth.welcomeBack"));
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message || t("twoFA.invalidCode"));
      shakeCard();
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("rememberEmail");
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="auth-split">
      {/* Left Panel - Desktop Only */}
      <div className="auth-split-left">
        <ParticleCanvas />
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
          <div className="auth-left-brand">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]">
                <Zap className="w-5 h-5 text-[#09090b]" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
                  NexusBot
                </div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {t("common.platform")}
                </div>
              </div>
            </div>

            <h2 className="auth-left-title">
              {t("auth.leftTitleLine1")}
              <br />
              <span className="text-[var(--accent)]">{t("auth.leftTitleLine2")}</span>
            </h2>
            <p className="auth-left-subtitle">{t("auth.leftSubtitle")}</p>

            <div className="mt-8 space-y-3">
              <FeatureItem icon={<Bot className="w-4 h-4" />} label={t("auth.featureBots")} />
              <FeatureItem icon={<TrendingUp className="w-4 h-4" />} label={t("auth.featureData")} />
              <FeatureItem icon={<Shield className="w-4 h-4" />} label={t("auth.featureSecurity")} />
              <FeatureItem icon={<Zap className="w-4 h-4" />} label={t("auth.featurePaper")} />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="auth-split-right">
        <AuthBackground />
        <SpotlightCard>
          <div ref={cardRef}>
            <div ref={contentRef}>
              {step === "credentials" ? (
                <>
                  <p className="reveal font-['Geist'] text-[13px] font-medium text-[#2dd4bf] mb-2 uppercase tracking-wider">
                    {t("auth.welcomeBackSubtitle")}
                  </p>
                  <h1 className="reveal auth-form-title">{t("auth.signInTitle")}</h1>
                  <p className="reveal auth-form-subtitle">{t("auth.signInDesc")}</p>

                  <form onSubmit={handleSubmit} className="reveal">
                    <div className="auth-field">
                      <label className="auth-field-label">{t("auth.email")}</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("auth.emailPlaceholder")}
                        className={`auth-field-input ${errors.email ? "auth-field-error" : ""}`}
                        required
                      />
                      {errors.email && <p className="auth-field-error-text">{errors.email}</p>}
                    </div>

                    <div className="auth-field">
                      <label className="auth-field-label">{t("auth.password")}</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t("auth.passwordPlaceholder")}
                          className={`auth-field-input pr-10 ${errors.password ? "auth-field-error" : ""}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="auth-field-error-text">{errors.password}</p>}
                    </div>

                    <div className="reveal flex items-center justify-between mb-5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="auth-checkbox"
                        />
                        <span className="font-['Geist'] text-[13px] text-[#71717a]">{t("auth.rememberMe")}</span>
                      </label>
                      <Link to="/forgot-password" className="auth-text-link">
                        {t("auth.forgotPassword")}
                      </Link>
                    </div>

                    <button type="submit" disabled={isLoading} className="reveal auth-btn auth-btn-teal">
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="auth-spinner" />
                          {t("auth.signingIn")}...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {t("auth.signIn")}
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  </form>

                  <p className="reveal mt-6 text-center font-['Geist'] text-[13px] text-[#52525b]">
                    {t("auth.noAccount")}{" "}
                    <Link to="/register" className="auth-text-link">
                      {t("auth.createOne")}
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="reveal font-['Geist'] text-[13px] font-medium text-[#2dd4bf] mb-2 uppercase tracking-wider">
                    {t("twoFA.subtitle")}
                  </p>
                  <h1 className="reveal auth-form-title">{t("twoFA.enterCode")}</h1>
                  <p className="reveal auth-form-subtitle">{t("twoFA.enterCodeDesc")}</p>

                  <form onSubmit={handleSubmit} className="reveal">
                    <div className="flex justify-center mb-5">
                      <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
                        <KeyRound className="w-6 h-6" />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-3 py-3 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] text-lg text-[var(--text-primary)] text-center tracking-[0.5em] outline-none focus:border-[var(--primary)] mb-5"
                      maxLength={6}
                      autoFocus
                    />

                    <button
                      type="submit"
                      disabled={totpCode.length !== 6 || login2FA.isPending}
                      className="reveal auth-btn auth-btn-teal"
                    >
                      {login2FA.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("common.verifying")}...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {t("common.verify")}
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  </form>

                  <p className="reveal mt-6 text-center font-['Geist'] text-[13px] text-[#52525b]">
                    <button
                      type="button"
                      onClick={() => { setStep("credentials"); setTotpCode(""); }}
                      className="auth-text-link"
                    >
                      {t("auth.backToLogin")}
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
