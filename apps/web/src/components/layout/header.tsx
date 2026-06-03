import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";
import { useWallet } from "../../hooks/use-api";
import { useTheme } from "../../hooks/use-theme";
import { useNotificationStore } from "../../hooks/use-notifications";
import {
  LogOut,
  ChevronDown,
  Wallet,
  Bell,
  Settings,
  User,
  Copy,
  Check,
  Moon,
  Sun,
  X,
  Trash2,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export function Header() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const toast = useToast();
  const { resolved, toggle } = useTheme();
  const [copied, setCopied] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  const notifications = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);

  useGSAP(
    () => {
      if (!headerRef.current) return;
      gsap.fromTo(
        headerRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 0.05 }
      );
    },
    { scope: headerRef }
  );

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node) &&
        notifBtnRef.current &&
        !notifBtnRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Animate dropdown
  useGSAP(
    () => {
      if (!dropdownRef.current) return;
      if (dropdownOpen) {
        gsap.fromTo(
          dropdownRef.current,
          { opacity: 0, y: -6, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power3.out" }
        );
      }
    },
    { scope: dropdownRef, dependencies: [dropdownOpen] }
  );

  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    []
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate({ to: "/login" });
    toast.info("Signed out successfully");
  }, [logout, navigate, toast]);

  const balance = wallet?.balance
    ? parseFloat(wallet.balance).toFixed(4)
    : "0.0000";
  const currency = wallet?.currency || "USDT";
  const walletAddress = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  return (
    <header
      ref={headerRef}
      className="
        h-16 px-4 sm:px-5 lg:px-6
        bg-[var(--bg-elevated)]/60 backdrop-blur-2xl
        border-b border-[var(--border-subtle)]
        flex items-center justify-between
        sticky top-0 z-[1200]
      "
    >
      {/* Left: Title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-[var(--text-muted)] hidden sm:inline-block truncate">
          Welcome back,
          <span className="text-[var(--text-secondary)] ml-1">{user?.email?.split("@")[0] || "Trader"}</span>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Wallet Balance Chip */}
        <div
          className="
            hidden sm:flex items-center gap-2
            px-3 py-1.5 rounded-full
            bg-[var(--success-glow)] border border-[var(--success)]/20
            text-[var(--success)] text-sm font-medium
            shadow-[0_0_12px_var(--success-glow)]
            transition-shadow duration-300 hover:shadow-[0_0_16px_var(--success-glow)]
          "
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">{balance} {currency}</span>
        </div>

        {/* Mobile balance */}
        <div className="sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--success-glow)] border border-[var(--success)]/20 text-[var(--success)] text-xs font-medium">
          <Wallet className="w-3 h-3" />
          <span>{balance}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="relative p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-200"
          title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolved === "dark" ? (
            <Sun className="w-[18px] h-[18px]" />
          ) : (
            <Moon className="w-[18px] h-[18px]" />
          )}
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            ref={notifBtnRef}
            onClick={() => setNotifOpen((v) => !v)}
            className="
              relative p-2 rounded-xl
              text-[var(--text-muted)] hover:text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)]
              transition-colors duration-200
            "
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-bold text-[var(--text-invert)] shadow-[0_0_6px_var(--primary-glow)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              ref={notifRef}
              className="
                absolute right-0 top-[calc(100%+10px)] w-[360px] max-w-[calc(100vw-1rem)]
                bg-[var(--bg-card)]/95 backdrop-blur-2xl
                border border-[var(--border-subtle)]
                rounded-xl
                shadow-[0_0_40px_rgba(0,0,0,0.4)]
                overflow-hidden z-[1400]
              "
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <span className="text-sm font-medium text-[var(--text-primary)]">Notifications</span>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="p-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      title="Mark all read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-glow)] transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon =
                      n.type === "success"
                        ? CheckCircle2
                        : n.type === "error"
                        ? AlertCircle
                        : n.type === "warning"
                        ? AlertTriangle
                        : Info;
                    const color =
                      n.type === "success"
                        ? "text-[var(--success)]"
                        : n.type === "error"
                        ? "text-[var(--danger)]"
                        : n.type === "warning"
                        ? "text-[var(--warning)]"
                        : "text-[var(--primary)]";
                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`
                          flex items-start gap-3 px-4 py-3 border-b border-[var(--border-subtle)]
                          hover:bg-[var(--bg-hover)]/50 cursor-pointer transition-colors
                          ${n.read ? "opacity-60" : ""}
                        `}
                      >
                        <div className={`mt-0.5 shrink-0 ${color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-secondary)] leading-snug">
                            {n.title}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]/60 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar + Dropdown */}
        <div className="relative">
          <button
            ref={avatarRef}
            onClick={() => setDropdownOpen((v) => !v)}
            className="
              flex items-center gap-2 pl-1 pr-2 py-1 rounded-full
              bg-[var(--bg-hover)] border border-[var(--border-subtle)]
              hover:bg-[var(--bg-pressed)] hover:border-[var(--border-default)]
              transition-all duration-200
            "
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center text-[11px] font-bold text-white shadow-[0_0_10px_rgba(var(--accent-rgb),0.25)]">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <ChevronDown
              className={`
                w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 hidden sm:block
                ${dropdownOpen ? "rotate-180" : ""}
              `}
            />
          </button>

          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="
                absolute right-0 top-[calc(100%+10px)] w-64
                bg-[var(--bg-card)] border border-[var(--border-default)]
                rounded-xl
                shadow-[0_0_40px_rgba(0,0,0,0.5)]
                overflow-hidden
              "
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center text-xs font-bold text-white shadow-[0_0_12px_rgba(var(--accent-rgb),0.25)]">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {user?.email || "User"}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] capitalize">
                      {user?.role || "member"}
                    </span>
                  </div>
                </div>

                {walletAddress && (
                  <button
                    onClick={() => wallet?.address && handleCopy(wallet.address)}
                    className="
                      mt-2.5 w-full flex items-center justify-between gap-2
                      px-2.5 py-1.5 rounded-lg
                      bg-[var(--bg-hover)] border border-[var(--border-subtle)]
                      text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]
                      transition-colors duration-150
                    "
                  >
                    <span className="font-mono truncate">{walletAddress}</span>
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    )}
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate({ to: "/profile" });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                >
                  <User className="w-4 h-4 text-[var(--text-muted)]" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate({ to: "/settings" });
                  }}
                  className="
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                    text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                    hover:bg-[var(--bg-hover)]
                    transition-colors duration-150
                  "
                >
                  <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                  Settings
                </button>
                <div className="my-1 border-t border-[var(--border-subtle)]" />
                <button
                  onClick={handleLogout}
                  className="
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                    text-sm text-[var(--danger)] hover:text-[var(--danger)]
                    hover:bg-[var(--danger-glow)]
                    transition-colors duration-150
                  "
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
