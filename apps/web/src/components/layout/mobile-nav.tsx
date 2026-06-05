import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "../../hooks/use-auth";
import { useI18n } from "../../hooks/use-i18n";
import {
  LayoutDashboard,
  Wallet,
  Bot,
  Users,
  Plug,
  Calculator,
  Trophy,
  Terminal,
  BookOpen,
  Shield,
} from "lucide-react";

const nav = [
  { to: "/dashboard", tKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/wallet", tKey: "nav.wallet", icon: Wallet },
  { to: "/bots", tKey: "nav.bots", icon: Bot },
  { to: "/rankings", tKey: "nav.rankings", icon: Trophy },
  { to: "/profile", tKey: "nav.profile", icon: Users },
];

const extra = [
  { to: "/ai-integration", tKey: "nav.aiIntegration", icon: Terminal },
  { to: "/api-docs", tKey: "nav.apiDocs", icon: BookOpen },
];

export function MobileNav() {
  const { pathname } = useLocation();
  const user = useAuth((s) => s.user);
  const { t } = useI18n();

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <nav className="lg:hidden flex items-center justify-around bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] px-1 z-[1200]">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 py-2 px-1.5 flex-1 min-w-0 rounded-md transition-colors duration-200 ${
              active
                ? "text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[9px] font-medium truncate w-full text-center">{t(item.tKey)}</span>
          </Link>
        );
      })}
      {extra.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 py-2 px-1.5 flex-1 min-w-0 rounded-md transition-colors duration-200 ${
              active
                ? "text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[9px] font-medium truncate w-full text-center">{t(item.tKey)}</span>
          </Link>
        );
      })}
      {user?.role === "admin" && (
        <Link
          to="/admin"
          className={`flex flex-col items-center gap-0.5 py-2 px-1.5 flex-1 min-w-0 rounded-md transition-colors duration-200 ${
            isActive("/admin")
              ? "text-[var(--warning)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Shield className="w-[18px] h-[18px] shrink-0" />
          <span className="text-[9px] font-medium truncate w-full text-center">{t("nav.admin")}</span>
        </Link>
      )}
    </nav>
  );
}
