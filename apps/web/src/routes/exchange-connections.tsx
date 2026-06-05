import { createFileRoute } from "@tanstack/react-router";
import { ExchangeConnectionManager } from "../components/bots/exchange-connection-manager";
import { PageWrapper } from "../components/layout/page-wrapper";
import { useI18n } from "../hooks/use-i18n";

export const Route = createFileRoute("/exchange-connections")({
  component: ExchangeConnectionsPage,
});

function ExchangeConnectionsPage() {
  const { t } = useI18n();
  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="gsap-section">
          <h1 className="text-xl font-bold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">{t("nav.exchanges")}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {t("exchanges.pageDescription")}
          </p>
        </div>
        <div className="gsap-section">
          <ExchangeConnectionManager />
        </div>
      </div>
    </PageWrapper>
  );
}
