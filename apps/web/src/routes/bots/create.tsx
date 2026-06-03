import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import BotWizard from "../../components/bots/bot-wizard";
import { PageWrapper } from "../../components/layout/page-wrapper";

export const Route = createFileRoute("/bots/create")({
  component: CreateBotPage,
});

function CreateBotPage() {
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <div className="mx-auto max-w-4xl">
        <div className="gsap-section mb-6 flex items-center gap-4">
          <Link
            to="/bots"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Create Bot</h1>
        </div>

        <div className="gsap-section rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <BotWizard onSuccess={() => navigate({ to: "/bots" })} />
        </div>
      </div>
    </PageWrapper>
  );
}
