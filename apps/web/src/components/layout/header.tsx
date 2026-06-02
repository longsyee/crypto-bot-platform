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
  Monitor,
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
  const { theme, resolved, toggle } = useTheme();
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
        bg-[#0f1117]/60 backdrop-blur-2xl
        border-b border-white/[0.06]
        flex items-center justify-between
        sticky top-0 z-[1200]
      "
    >
      {/* Left: Title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-slate-400 hidden sm:inline-block truncate">
          Welcome back,
          <span className="text-slate-200 ml-1">{user?.email?.split("@")[0] || "Trader"}</span>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Wallet Balance Chip */}
        <div
          className="
            hidden sm:flex items-center gap-2
            px-3 py-1.5 rounded-full
            bg-emerald-500/10 border border-emerald-500/20
            text-emerald-400 text-sm font-medium
            shadow-[0_0_12px_rgba(16,185,129,0.08)]
            transition-shadow duration-300 hover:shadow-[0_0_16px_rgba(16,185,129,0.15)]
          "
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">{balance} {currency}</span>
        </div>

        {/* Mobile balance (smaller) */}
        <div className="sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Wallet className="w-3 h-3" />
          <span>{balance}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors duration-200"
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
              text-slate-400 hover:text-white
              hover:bg-white/[0.05]
              transition-colors duration-200
            "
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(59,130,246,0.5)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              ref={notifRef}
              className="
                absolute right-0 top-[calc(100%+10px)] w-[360px] max-w-[calc(100vw-1rem)]
                bg-[#13161f]/95 backdrop-blur-2xl
                border border-white/[0.08]
                rounded-xl
                shadow-[0_0_40px_rgba(0,0,0,0.4)]
                overflow-hidden z-[1400]
              "
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <span className="text-sm font-medium text-white">Notifications</span>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                      title="Mark all read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
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
                        ? "text-emerald-400"
                        : n.type === "error"
                        ? "text-red-400"
                        : n.type === "warning"
                        ? "text-amber-400"
                        : "text-blue-400";
                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`
                          flex items-start gap-3 px-4 py-3 border-b border-white/[0.04]
                          hover:bg-white/[0.03] cursor-pointer transition-colors
                          ${n.read ? "opacity-60" : ""}
                        `}
                      >
                        <div className={`mt-0.5 shrink-0 ${color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 leading-snug">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                          className="p-1 rounded hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors shrink-0"
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
              bg-white/[0.04] border border-white/[0.08]
              hover:bg-white/[0.07] hover:border-white/[0.12]
              transition-all duration-200
            "
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-[11px] font-bold text-[#09090b] shadow-[0_0_10px_rgba(45,212,191,0.25)]">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <ChevronDown
              className={`
                w-3.5 h-3.5 text-slate-500 transition-transform duration-200 hidden sm:block
                ${dropdownOpen ? "rotate-180" : ""}
              `}
            />
          </button>

          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="
                absolute right-0 top-[calc(100%+10px)] w-64
                bg-[#13161f]/95 backdrop-blur-2xl
                border border-white/[0.08]
                rounded-xl
                shadow-[0_0_40px_rgba(0,0,0,0.4)]
                overflow-hidden
              "
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-[#09090b] shadow-[0_0_12px_rgba(45,212,191,0.25)]">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-white truncate">
                      {user?.email || "User"}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">
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
                      bg-white/[0.03] border border-white/[0.06]
                      text-xs text-slate-400 hover:text-slate-200
                      transition-colors duration-150
                    "
                  >
                    <span className="font-mono truncate">{walletAddress}</span>
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors duration-150"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate({ to: "/settings" });
                  }}
                  className="
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                    text-sm text-slate-300 hover:text-white
                    hover:bg-white/[0.05]
                    transition-colors duration-150
                  "
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  Settings
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={handleLogout}
                  className="
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                    text-sm text-red-400 hover:text-red-300
                    hover:bg-red-500/10
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
