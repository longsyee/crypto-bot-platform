import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator as CalculatorIcon, Sparkles } from "lucide-react";
import DCACalculator from "../components/bots/dca-calculator";
import { Button } from "../components/ui/button";
import { PageWrapper } from "../components/layout/page-wrapper";
import { useI18n } from "../hooks/use-i18n";

export const Route = createFileRoute("/calculator")({
  component: CalculatorPage,
});

function CalculatorPage() {
  const { t } = useI18n();
  return (
    <PageWrapper>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="gsap-section mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <CalculatorIcon className="w-4 h-4 text-[var(--primary)]" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-['Space_Grotesk']">
              {t("calculator.title")}
            </h1>
          </div>
          <p className="text-[var(--text-muted)] max-w-2xl text-xs leading-relaxed">
            {t("calculator.description")}
          </p>
        </div>

        <div className="gsap-section">
          <DCACalculator />
        </div>

        <div className="gsap-section mt-6 flex justify-end">
          <Link to="/bots/create">
            <Button className="gap-1 px-2 py-1 text-[11px] rounded-md bg-[var(--primary)] hover:brightness-110 text-[var(--text-invert)]">
              <Sparkles className="w-3.5 h-3.5" />
              {t("calculator.useTheseSettings")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
