import { useRef, useState, useEffect } from "react";
import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "../hooks/use-auth";
import { api } from "../lib/api-client";
import { useToast } from "../hooks/use-toast";
import { Eye, EyeOff, ArrowRight, Bot, Zap, Shield, TrendingUp } from "lucide-react";
import { AuthBackground } from "../components/auth/auth-background";
import { SpotlightCard } from "../components/auth/spotlight-card";
import { ParticleCanvas } from "../components/auth/particle-canvas";
import gsap from "gsap";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function FeatureItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-400">
      <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-teal-400">
        {icon}
      </span>
      {label}
    </div>
  );
}

function LoginPage() {
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (!contentRef.current) return;
    const els = contentRef.current.querySelectorAll(".reveal");
    gsap.fromTo(
      els,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", delay: 0.2 }
    );
  }, []);

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
    setErrors({});
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    if (!password) nextErrors.password = "Password is required";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      shakeCard();
      return;
    }

    setIsLoading(true);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth(data.accessToken, data.refreshToken, data.user);
      if (rememberMe) localStorage.setItem("rememberEmail", email);
      else localStorage.removeItem("rememberEmail");
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
      shakeCard();
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("rememberEmail");
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  return (
    <div className="auth-split">
      {/* Left Panel - Desktop Only */}
      <div className="auth-split-left">
        <ParticleCanvas />
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
          <div className="auth-left-brand">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.3)]">
              <Zap className="w-5 h-5 text-[#09090b]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-gray-900 dark:text-white font-['Space_Grotesk'] tracking-tight">NexusBot</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Trading Platform</div>
            </div>
          </div>

          <h2 className="auth-left-title">
            Trade smarter.
            <br />
            <span className="text-teal-400">Automate everything.</span>
          </h2>
          <p className="auth-left-subtitle">
            Build, backtest, and deploy automated trading bots across top crypto exchanges — all from one powerful dashboard.
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

      {/* Right Panel - Form */}
      <div className="auth-split-right">
        <AuthBackground />
        <SpotlightCard>
          <div ref={cardRef}>
            <div ref={contentRef}>
              <p className="reveal font-['Geist'] text-[13px] font-medium text-[#2dd4bf] mb-2 uppercase tracking-wider">
                Welcome back
              </p>
              <h1 className="reveal auth-form-title">Sign in to your account</h1>
              <p className="reveal auth-form-subtitle">
                Enter your credentials to access your trading dashboard.
              </p>

              <form onSubmit={handleSubmit} className="reveal">
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
                      placeholder="Enter your password"
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
                    <span className="font-['Geist'] text-[13px] text-[#71717a]">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="auth-text-link">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="reveal auth-btn auth-btn-teal"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="auth-spinner" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </form>

              <p className="reveal mt-6 text-center font-['Geist'] text-[13px] text-[#52525b]">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="auth-text-link">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
