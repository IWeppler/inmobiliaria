import Link from "next/link";
import { CalendarClock, Landmark } from "lucide-react";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { daysBetween, formatDate, money } from "@/features/rentals/logic";
import {
  ACTIVE_DEAL_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_TONE, LOAN_STATUS_LABELS, checklistProgress, dealDueDate,
  type DealChecklist, type DealStage,
} from "@/features/dashboard/deals/deal";

export type DealRow = {
  id: string; name: string; deal_stage: string; deal_price: number | null; deal_currency: string | null;
  reserva_expires_at: string | null; boleto_at: string | null; escritura_at: string | null;
  deal_financing: boolean; deal_bank: string | null; deal_loan_status: string | null;
  deal_checklist: unknown; deal_lost_reason: string | null; deal_updated_at: string | null;
  property: { id: string; title: string; status: string | null } | null;
  agent: { full_name: string } | null;
};

// Tablero de operaciones: una columna por etapa en curso, con la fecha que
// importa en cada una. Abajo, lo escriturado y lo caído de los últimos 90 días.
export function DealsBoard({ deals, today, showAgent }: { deals: DealRow[]; today: string; showAgent: boolean }) {
  const active = deals.filter((d) => ACTIVE_DEAL_STAGES.includes(d.deal_stage as DealStage));
  const closed = deals.filter((d) => d.deal_stage === "ESCRITURADA" || d.deal_stage === "CAIDA");

  return (
    <div className="space-y-6">
      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No hay operaciones en curso. Se abren desde el detalle de un lead con <span className="font-medium text-foreground">Registrar reserva</span>.
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="grid min-w-[880px] grid-cols-4 gap-3">
            {ACTIVE_DEAL_STAGES.map((stage) => {
              const items = active.filter((d) => d.deal_stage === stage)
                .sort((a, b) => (dealDueDate(a).date ?? "9999").localeCompare(dealDueDate(b).date ?? "9999"));
              return (
                <section key={stage} className="flex min-w-0 flex-col rounded-lg bg-muted/40 p-2" aria-label={DEAL_STAGE_LABELS[stage]}>
                  <h2 className="flex items-center justify-between px-1.5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {DEAL_STAGE_LABELS[stage]} <span className="tabular-nums">{items.length}</span>
                  </h2>
                  <ul className="space-y-2">
                    {items.map((d) => <DealItem key={d.id} deal={d} today={today} showAgent={showAgent} />)}
                    {items.length === 0 && <li className="px-1.5 py-3 text-xs text-muted-foreground">Nada en esta etapa.</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Terminadas en los últimos 90 días</h2>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
            {closed.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <StatusBadge tone={DEAL_STAGE_TONE[d.deal_stage as DealStage]}>{DEAL_STAGE_LABELS[d.deal_stage as DealStage]}</StatusBadge>
                <Link href={`/dashboard/leads/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {[d.property?.title, d.deal_stage === "CAIDA" ? d.deal_lost_reason : d.escritura_at && `Escriturada el ${formatDate(d.escritura_at)}`].filter(Boolean).join(" · ")}
                </span>
                {d.deal_stage === "ESCRITURADA" && d.property?.status !== "VENDIDO" && (
                  <Link href={`/dashboard/leads/${d.id}`} className="text-xs font-medium text-warning hover:underline">Falta registrar la venta</Link>
                )}
                <span className="tabular-nums text-muted-foreground">{money(d.deal_price, d.deal_currency ?? "USD")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DealItem({ deal, today, showAgent }: { deal: DealRow; today: string; showAgent: boolean }) {
  const stage = deal.deal_stage as DealStage;
  const due = dealDueDate(deal);
  const days = due.date ? daysBetween(today, due.date) : null;
  const progress = checklistProgress(stage, (deal.deal_checklist as DealChecklist) ?? {});
  return (
    <li>
      <Link href={`/dashboard/leads/${deal.id}`}
        className="block space-y-1.5 rounded-md border border-border bg-card p-3 text-sm shadow-xs transition-colors hover:border-primary/40">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{deal.name}</span>
          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{money(deal.deal_price, deal.deal_currency ?? "USD")}</span>
        </div>
        {deal.property && <p className="truncate text-xs text-muted-foreground">{deal.property.title}</p>}
        {due.date && (
          <p className={cn("flex items-center gap-1 text-xs", days !== null && days < 0 ? "font-medium text-danger" : days !== null && days <= 3 ? "font-medium text-warning" : "text-muted-foreground")}>
            <CalendarClock className="size-3.5" aria-hidden />
            {due.label}: {formatDate(due.date)}{days !== null && (days < 0 ? ` (hace ${-days} d)` : days === 0 ? " (hoy)" : ` (${days} d)`)}
          </p>
        )}
        {deal.deal_financing && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Landmark className="size-3.5" aria-hidden />
            {[deal.deal_bank ?? "Crédito", deal.deal_loan_status ? LOAN_STATUS_LABELS[deal.deal_loan_status] : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {progress.total > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-primary" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </span>
              {progress.done}/{progress.total}
            </span>
          )}
          {showAgent && deal.agent && <span className="truncate text-xs text-muted-foreground">{deal.agent.full_name}</span>}
        </div>
      </Link>
    </li>
  );
}
