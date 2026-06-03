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
  Trophy,
  Terminal,
  BookOpen,
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
  { to: "/rankings", label: "Rankings", icon: Trophy },
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
        group relative flex items-center gap-3 px-3 py-2 rounded-md text-[11px] font-medium
        transition-colors duration-200
        ${
          active
            ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-l-2 border-[var(--primary)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] border-l-2 border-transparent"
        }
      `}
    >
      <span
        ref={glowRef}
        className="absolute inset-0 rounded-md bg-gradient-to-r from-[var(--primary)]/10 to-transparent opacity-0 pointer-events-none"
      />
      <Icon className="w-[16px] h-[16px] relative z-10 shrink-0" />
      <span className="relative z-10 truncate">{item.label}</span>
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
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        className="lg:hidden fixed top-3 left-4 z-[1700] p-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
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
        className="fixed inset-0 bg-[var(--bg-base)]/70 z-[1300] opacity-0 pointer-events-none lg:hidden"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed lg:static inset-y-0 left-0 z-[1400] w-[240px] flex flex-col
          bg-[var(--bg-elevated)]
          border-r border-[var(--border-subtle)]
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          will-change-transform
        `}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
          <div className="w-7 h-7 rounded-sm bg-[var(--accent)] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] leading-none font-['Space_Grotesk']">
              NexusBot
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold leading-none mt-0.5">
              Trading Platform
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-px bg-[var(--border-subtle)] overflow-y-auto">
          <div className="bg-[var(--bg-elevated)] px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
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

          <div className="bg-[var(--bg-elevated)] px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
            Developer
          </div>
          <Link
            to="/ai-integration"
            onClick={() => setMobileOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-md text-[11px] font-medium
              transition-colors duration-200
              ${
                pathname === "/ai-integration"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-l-2 border-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50 border-l-2 border-transparent"
              }
            `}
          >
            <Terminal className={`w-[16px] h-[16px] shrink-0 ${pathname === "/ai-integration" ? "text-[var(--primary)]" : ""}`} />
            <span className="truncate">AI Integration</span>
          </Link>
          <Link
            to="/api-docs"
            onClick={() => setMobileOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-md text-[11px] font-medium
              transition-colors duration-200
              ${
                pathname === "/api-docs"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-l-2 border-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50 border-l-2 border-transparent"
              }
            `}
          >
            <BookOpen className={`w-[16px] h-[16px] shrink-0 ${pathname === "/api-docs" ? "text-[var(--primary)]" : ""}`} />
            <span className="truncate">API Docs</span>
          </Link>

          {user?.role === "admin" && (
            <>
              <div className="bg-[var(--bg-elevated)] px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                Administration
              </div>
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-md text-[11px] font-medium
                  transition-colors duration-200
                  ${
                    pathname === "/admin"
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-l-2 border-[var(--warning)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50 border-l-2 border-transparent"
                  }
                `}
              >
                <Shield className={`w-[16px] h-[16px] shrink-0 ${pathname === "/admin" ? "text-[var(--warning)]" : ""}`} />
                <span className="truncate">Admin</span>
              </Link>
            </>
          )}
        </nav>

        {/* Bottom gradient */}
        <div className="pointer-events-none h-6 bg-gradient-to-t from-[var(--bg-elevated)] to-transparent" />
      </aside>
    </>
  );
}
