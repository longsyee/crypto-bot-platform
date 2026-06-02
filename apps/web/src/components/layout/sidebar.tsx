import { useRef, useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Bot,
  Users,
  Shield,
  Menu,
  X,
  Zap,
  Calculator,
  Plug,
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/exchange-connections", label: "Exchanges", icon: Plug },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/calculator", label: "DCA Simulator", icon: Calculator },
  { to: "/referrals", label: "Referrals", icon: Users },
];

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof nav)[number];
  active: boolean;
  onClick?: () => void;
}) {
  const itemRef = useRef<HTMLAnchorElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const Icon = item.icon;

  const handleEnter = useCallback(() => {
    if (!itemRef.current || active) return;
    gsap.to(itemRef.current, {
      x: 4,
      duration: 0.25,
      ease: "power2.out",
    });
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 1,
        duration: 0.25,
      });
    }
  }, [active]);

  const handleLeave = useCallback(() => {
    if (!itemRef.current || active) return;
    gsap.to(itemRef.current, {
      x: 0,
      duration: 0.3,
      ease: "power2.out",
    });
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 0,
        duration: 0.3,
      });
    }
  }, [active]);

  return (
    <Link
      ref={itemRef}
      to={item.to}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-colors duration-200
        ${
          active
            ? "bg-white/5 text-white border border-white/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
            : "text-slate-400 hover:text-white border border-transparent"
        }
      `}
    >
      <span
        ref={glowRef}
        className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 pointer-events-none"
      />
      <span
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r-full
          transition-opacity duration-200
          ${active ? "opacity-100 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "opacity-0"}
        `}
      />
      <Icon className="w-[18px] h-[18px] relative z-10 shrink-0" />
      <span className="relative z-10 truncate">{item.label}</span>
      {active && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const user = useAuth((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sidebarRef.current) return;
      gsap.fromTo(
        sidebarRef.current,
        { x: -40, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: 0.1 }
      );
    },
    { scope: sidebarRef }
  );

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
    if (overlayRef.current) {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, pointerEvents: "none" });
    }
  }, [pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        if (overlayRef.current) {
          gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, pointerEvents: "none" });
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => {
      const next = !prev;
      if (overlayRef.current) {
        gsap.to(overlayRef.current, {
          opacity: next ? 1 : 0,
          duration: 0.2,
          pointerEvents: next ? "auto" : "none",
        });
      }
      return next;
    });
  }, []);

  return (
    <>
      {/* Mobile hamburger — visible on mobile & tablet */}
      <button
        onClick={toggleMobile}
        className="lg:hidden fixed top-3.5 left-4 z-[1700] p-2 rounded-xl bg-[#1a1d29]/90 backdrop-blur-xl border border-white/[0.08] text-white shadow-lg transition-colors hover:bg-[#1a1d29]"
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay backdrop */}
      <div
        ref={overlayRef}
        onClick={() => {
          setMobileOpen(false);
          if (overlayRef.current) {
            gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, pointerEvents: "none" });
          }
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1300] opacity-0 pointer-events-none lg:hidden"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed lg:static inset-y-0 left-0 z-[1400] w-[260px] flex flex-col
          bg-[#0f1117]/95 lg:bg-[#0f1117]/80
          backdrop-blur-2xl
          border-r border-white/[0.06]
          shadow-[0_0_60px_rgba(0,0,0,0.4)]
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          will-change-transform
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(45,212,191,0.3)]">
            <Zap className="w-4 h-4 text-[#09090b]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight text-white leading-none font-['Space_Grotesk']">
              NexusBot
            </span>
            <span className="text-[10px] text-slate-500 leading-none mt-0.5 tracking-wide uppercase">
              Trading Platform
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
            Platform
          </div>
          {nav.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
              onClick={() => setMobileOpen(false)}
            />
          ))}

          {user?.role === "admin" && (
            <>
              <div className="px-3 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                Administration
              </div>
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-colors duration-200
                  ${
                    pathname === "/admin"
                      ? "bg-white/5 text-white border border-white/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
                  }
                `}
              >
                <Shield className={`w-[18px] h-[18px] shrink-0 ${pathname === "/admin" ? "text-amber-400" : ""}`} />
                <span className="truncate">Admin</span>
                {pathname === "/admin" && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)] shrink-0" />
                )}
              </Link>
            </>
          )}
        </nav>

        {/* Bottom gradient */}
        <div className="pointer-events-none h-8 bg-gradient-to-t from-[#0f1117] to-transparent" />
      </aside>
    </>
  );
}
