import { createFileRoute } from "@tanstack/react-router";
import { ExchangeConnectionManager } from "../components/bots/exchange-connection-manager";
import { PageWrapper } from "../components/layout/page-wrapper";

export const Route = createFileRoute("/exchange-connections")({
  component: ExchangeConnectionsPage,
});

function ExchangeConnectionsPage() {
  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="gsap-section">
          <h1 className="text-xl font-bold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">Exchange Connections</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Connect your exchange API keys for real mainnet trading. All credentials are encrypted at rest. Use Paper Trading mode per-bot to practice without risking real funds.
          </p>
        </div>
        <div className="gsap-section">
          <ExchangeConnectionManager />
        </div>
      </div>
    </PageWrapper>
  );
}
