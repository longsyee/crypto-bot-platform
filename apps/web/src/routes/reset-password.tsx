import { useRef, useState, useEffect } from "react";
import { Link, useNavigate, createFileRoute, useSearch } from "@tanstack/react-router";
import { api } from "../lib/api-client";
import { useToast } from "../hooks/use-toast";
import { useI18n } from "../hooks/use-i18n";
import { Eye, EyeOff, Lock, CheckCircle, Zap } from "lucide-react";
import { AuthBackground } from "../components/auth/auth-background";
import { SpotlightCard } from "../components/auth/spotlight-card";
import { ParticleCanvas } from "../components/auth/particle-canvas";
import gsap from "gsap";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const search = useSearch({ from: "/reset-password" }) as { token?: string };
  const token = search.token || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    if (!contentRef.current) return;
    const els = contentRef.current.querySelectorAll(".reveal");
    gsap.fromTo(
      els,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.2 }
    );
  }, [done]);

  function shakeCard() {
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove("auth-shake");
    void card.offsetWidth;
    card.classList.add("auth-shake");
    gsap.fromTo(card, { x: -4 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
  }

  useEffect(() => {
    if (!token) toast.error(t("auth.invalidResetToken"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const next: typeof errors = {};
    if (!password) next.password = t("auth.passwordRequired");
    else if (password.length < 8) next.password = t("auth.passwordMinLength");
    if (password !== confirmPassword) next.confirmPassword = t("auth.passwordsDoNotMatch");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      shakeCard();
      return;
    }
    if (!token) { toast.error(t("auth.invalidResetToken")); return; }

    setIsLoading(true);
    try {
      await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
      toast.success(t("auth.passwordUpdated"));
    } catch (err: any) {
      toast.error(err.message || t("auth.resetPasswordFailed"));
      shakeCard();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-split-left">
        <ParticleCanvas />
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
          <div className="auth-left-brand">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#09090b]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">{t("auth.brandName")}</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t("auth.brandSubtitle")}</div>
            </div>
          </div>

          <h2 className="auth-left-title">
            {t("auth.leftTitleLine1")}
            <br />
            <span className="text-[var(--accent)]">{t("auth.leftTitleLine2")}</span>
          </h2>
          <p className="auth-left-subtitle">
            {t("auth.leftSubtitle")}
          </p>
        </div>
      </div>
      </div>

      <div className="auth-split-right">
        <AuthBackground />
        <SpotlightCard>
          <div ref={cardRef}>
            <div ref={contentRef}>
              <p className="reveal font-['Geist'] text-[13px] font-medium text-[#2dd4bf] mb-2 uppercase tracking-wider">
                {done ? t("common.success") : t("auth.newPassword")}
              </p>
              <h1 className="reveal auth-form-title">
                {done ? t("auth.passwordUpdatedTitle") : t("auth.setNewPassword")}
              </h1>
              <p className="reveal auth-form-subtitle">
                {done
                  ? t("auth.passwordResetSuccess")
                  : t("auth.enterNewPassword")}
              </p>

              {done ? (
                <div className="reveal">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/login" })}
                    className="auth-btn auth-btn-teal"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {t("auth.goToSignIn")}
                    </span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="reveal">
                  <div className="auth-field">
                    <label className="auth-field-label">{t("auth.newPassword")}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("auth.passwordMinPlaceholder")}
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

                  <div className="auth-field">
                    <label className="auth-field-label">{t("auth.confirmPassword")}</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t("auth.confirmPasswordPlaceholder")}
                        className={`auth-field-input pr-10 ${errors.confirmPassword ? "auth-field-error" : ""}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="auth-field-error-text">{errors.confirmPassword}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !token}
                    className="auth-btn auth-btn-teal"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="auth-spinner" />
                        {t("common.updating")}
                      </span>
                    ) : (
                      t("auth.updatePassword")
                    )}
                  </button>
                </form>
              )}

              <p className="reveal mt-6 text-center">
                <Link to="/login" className="auth-text-link">
                  {t("auth.backToLogin")}
                </Link>
              </p>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
