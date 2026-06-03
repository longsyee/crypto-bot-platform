import { useRef, useState, useEffect, useCallback } from "react";
import { Link, useNavigate, createFileRoute, useSearch } from "@tanstack/react-router";
import { useAuth } from "../hooks/use-auth";
import { api } from "../lib/api-client";
import { useToast } from "../hooks/use-toast";
import { Eye, EyeOff, ArrowRight, CheckCircle, RefreshCw, Zap, Bot, TrendingUp, Shield } from "lucide-react";
import { AuthBackground } from "../components/auth/auth-background";
import { SpotlightCard } from "../components/auth/spotlight-card";
import { ParticleCanvas } from "../components/auth/particle-canvas";
import { OtpInput } from "../components/auth/otp-input";
import gsap from "gsap";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
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

export default function RegisterPage() {
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Parse referral code from URL ?ref=REF-XXX
  const search = useSearch({ from: "/register" });
  const urlRef = (search as any)?.ref as string | undefined;

  const [referralCode, setReferralCode] = useState(urlRef || "");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!contentRef.current) return;
    const els = contentRef.current.querySelectorAll(".reveal");
    gsap.fromTo(
      els,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.2 }
    );
  }, [step]);

  // Sync URL ref param to state if present
  useEffect(() => {
    if (urlRef && !referralCode) {
      setReferralCode(urlRef);
    }
  }, [urlRef]);

  function shakeCard() {
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove("auth-shake");
    void card.offsetWidth;
    card.classList.add("auth-shake");
    gsap.fromTo(card, { x: -4 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
  }

  function validateStep1() {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Invalid email";
    if (!password) next.password = "Password is required";
    else if (password.length < 8) next.password = "Min 8 characters";
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep1()) { shakeCard(); return; }
    setIsLoading(true);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, referral_code: referralCode || undefined }),
      });
      setAuth(data.accessToken, data.refreshToken, data.user);
      toast.success("Account created! Check your email for the OTP.");
      setStep(2);
      setResendCountdown(60);
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
      shakeCard();
    } finally {
      setIsLoading(false);
    }
  }

  const handleOtpChange = useCallback((index: number, value: string) => {
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setOtpError("");
  }, [otp]);

  async function handleVerifyOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setOtpError("Enter the full 6-digit code");
      shakeCard();
      return;
    }
    setIsLoading(true);
    try {
      await api<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp: code }),
      });
      toast.success("Email verified!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setOtpError(err.message || "Invalid OTP");
      shakeCard();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0) return;
    setIsResending(true);
    try {
      await api<{ message: string }>("/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success("OTP resent!");
      setResendCountdown(60);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  }

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  return (
    <div className="auth-split">
      <div className="auth-split-left">
        <ParticleCanvas />
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
          <div className="auth-left-brand">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]">
              <Zap className="w-5 h-5 text-[#09090b]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">NexusBot</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Trading Platform</div>
            </div>
          </div>

          <h2 className="auth-left-title">
            Start trading
            <br />
            <span className="text-[var(--accent)]">in minutes.</span>
          </h2>
          <p className="auth-left-subtitle">
            Join thousands of traders who automate their strategies with DCA bots, signal trading, and paper trading.
          </p>

          <div className="mt-8 space-y-3">
            <FeatureItem icon={<Bot className="w-4 h-4" />} label="DCA & Signal Bots" />
            <FeatureItem icon={<TrendingUp className="w-4 h-4" />} label="Real-time Market Data" />
            <FeatureItem icon={<Shield className="w-4 h-4" />} label="Encrypted API Keys" />
            <FeatureItem icon={<Zap className="w-4 h-4" />} label="Paper Trading Mode" />
          </div>
        </div>
      </div>
      </div>

      <div className="auth-split-right">
        <AuthBackground />
        <SpotlightCard>
          <div ref={cardRef}>
            <div ref={contentRef}>
              <p className="reveal font-['Geist'] text-[13px] font-medium text-[#2dd4bf] mb-2 uppercase tracking-wider">
                {step === 1 ? "Get started" : "Verification"}
              </p>
              <h1 className="reveal auth-form-title">
                {step === 1 ? "Create your account" : "Verify your email"}
              </h1>
              <p className="reveal auth-form-subtitle">
                {step === 1
                  ? "Join thousands of traders automating their crypto strategies."
                  : <>
                      We sent a 6-digit code to{" "}
                      <strong className="text-[var(--text-primary)]">{email}</strong>
                    </>}
              </p>

              {step === 1 ? (
                <form onSubmit={handleRegister} className="reveal">
                  <div className="auth-field">
                    <label className="auth-field-label">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`auth-field-input ${errors.email ? "auth-field-error" : ""}`}
                      required
                    />
                    {errors.email && <p className="auth-field-error-text">{errors.email}</p>}
                  </div>

                  <div className="auth-field">
                    <label className="auth-field-label">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
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
                    <label className="auth-field-label">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
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

                  <div className="auth-field">
                    <label className="auth-field-label">
                      Referral Code{" "}
                      <span className="text-[#52525b] font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="REF-XXXXXXXX"
                      className={`auth-field-input ${urlRef ? "border-[var(--accent)]/30 bg-[var(--accent)]/[0.04]" : ""}`}
                    />
                    {urlRef && (
                      <p className="text-xs text-[var(--accent)] mt-1.5 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Auto-filled from invitation link
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="auth-btn auth-btn-teal"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="auth-spinner" />
                        Creating account...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>

                  <div className="auth-line">or</div>

                  <button
                    type="button"
                    onClick={() => navigate({ to: "/login" })}
                    className="auth-btn auth-btn-outline"
                  >
                    Already have an account? Sign in
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="reveal">
                  <OtpInput
                    value={otp}
                    onChange={handleOtpChange}
                    error={otpError}
                    onComplete={(code) => {
                      setOtp(code.split(""));
                      handleVerifyOtp();
                    }}
                  />

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="auth-btn auth-btn-teal mt-5"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="auth-spinner" />
                        Verifying...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Verify &amp; Sign In
                      </span>
                    )}
                  </button>

                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCountdown > 0 || isResending}
                      className="flex items-center gap-1.5 font-['Geist'] text-[13px] text-[#2dd4bf] hover:text-[#5eead4] disabled:text-[#3f3f46] disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                      {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend OTP"}
                    </button>
                  </div>

                  <div className="mt-4 text-center">
                    <button type="button" onClick={() => setStep(1)} className="auth-text-link">
                      Back to registration
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
