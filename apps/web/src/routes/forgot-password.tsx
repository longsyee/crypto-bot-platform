import { useRef, useState, useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { api } from "../lib/api-client";
import { useToast } from "../hooks/use-toast";
import { useI18n } from "../hooks/use-i18n";
import { Send, CheckCircle, Zap } from "lucide-react";
import { AuthBackground } from "../components/auth/auth-background";
import { SpotlightCard } from "../components/auth/spotlight-card";
import { ParticleCanvas } from "../components/auth/particle-canvas";
import gsap from "gsap";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useI18n();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contentRef.current) return;
    const els = contentRef.current.querySelectorAll(".reveal");
    gsap.fromTo(
      els,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.2 }
    );
  }, [sent]);

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
    setError("");
    if (!email.trim()) { setError(t("auth.emailRequired")); shakeCard(); return; }
    setIsLoading(true);
    try {
      await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
      toast.success(t("auth.resetLinkSent"));
    } catch (err: any) {
      toast.error(err.message || t("auth.resetLinkFailed"));
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
                {sent ? t("auth.checkInbox") : t("auth.passwordReset")}
              </p>
              <h1 className="reveal auth-form-title">
                {sent ? t("auth.emailSent") : t("auth.resetYourPassword")}
              </h1>
              <p className="reveal auth-form-subtitle">
                {sent
                  ? t("auth.resetLinkSentTo", { email })
                  : t("auth.resetDesc")}
              </p>

              {sent ? (
                <div className="reveal">
                  <p className="font-['Geist'] text-[14px] text-[#71717a] text-center mb-5">
                    {t("auth.didntReceive")}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSent(false); setEmail(""); }}
                    className="auth-btn auth-btn-teal"
                  >
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      {t("auth.tryAgain")}
                    </span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="reveal">
                  <div className="auth-field">
                    <label className="auth-field-label">{t("auth.emailAddress")}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      className={`auth-field-input ${error ? "auth-field-error" : ""}`}
                      required
                    />
                    {error && <p className="auth-field-error-text">{error}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="auth-btn auth-btn-teal"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="auth-spinner" />
                        {t("auth.sending")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t("auth.sendResetLink")}
                        <Send className="w-4 h-4" />
                      </span>
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
