import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { daysBetween, money } from "@/features/rentals/logic";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { ACTIVE_DEAL_STAGES, dealDueDate, type DealStage } from "@/features/dashboard/deals/deal";
import { DealsBoard, type DealRow } from "@/features/dashboard/deals/DealsBoard";

// /dashboard/operaciones: las ventas en curso, de la reserva a la escritura.
// RLS: el agente ve las suyas; admin, las del equipo.
export default async function OperacionesPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = ymdInAppTz();
  const since = addDays(today, -90);
  const [{ data: me }, { data }] = await Promise.all([
    supabase.from("agents").select("role").eq("id", user.id).single(),
    supabase.from("leads")
      .select(`id, name, deal_stage, deal_price, deal_currency, reserva_expires_at, boleto_at, escritura_at,
        deal_financing, deal_bank, deal_loan_status, deal_checklist, deal_lost_reason, deal_updated_at,
        property:properties(id, title, status), agent:agents(full_name)`)
      .not("deal_stage", "is", null),
  ]);
  const deals = ((data ?? []) as unknown as DealRow[])
    .filter((d) => ACTIVE_DEAL_STAGES.includes(d.deal_stage as DealStage) || (d.deal_updated_at ?? "") >= since);

  const active = deals.filter((d) => ACTIVE_DEAL_STAGES.includes(d.deal_stage as DealStage));
  const volume = new Map<string, number>();
  for (const d of active) if (d.deal_price) volume.set(d.deal_currency ?? "USD", (volume.get(d.deal_currency ?? "USD") ?? 0) + d.deal_price);
  const dueSoon = active.filter((d) => { const date = dealDueDate(d).date; return date && daysBetween(today, date) <= 7; });
  const overdue = dueSoon.filter((d) => daysBetween(today, dealDueDate(d).date!) < 0).length;
  const monthStart = `${today.slice(0, 7)}-01`;
  const closedMonth = deals.filter((d) => d.deal_stage === "ESCRITURADA" && (d.escritura_at ?? "") >= monthStart).length;
  const lost = deals.filter((d) => d.deal_stage === "CAIDA").length;

  return (
    <Page>
      <PageHeader title="Operaciones" description="Ventas en curso, de la reserva a la escritura." />
      <StatStrip>
        <Stat label="En curso" value={active.length} detail={`${active.filter((d) => d.deal_financing).length} con crédito`} />
        <Stat label="Volumen en curso" value={volume.size ? [...volume].map(([c, a]) => money(a, c)).join(" + ") : "-"} />
        <Stat label="Fechas en 7 días" value={dueSoon.length} tone={overdue ? "danger" : dueSoon.length ? "warning" : undefined}
          detail={overdue ? `${overdue} vencidas` : "Reservas, boletos y escrituras"} />
        <Stat label="Escrituradas este mes" value={closedMonth} detail={lost ? `${lost} caídas en 90 días` : undefined} />
      </StatStrip>
      <DealsBoard deals={deals} today={today} showAgent={me?.role === "admin"} />
    </Page>
  );
}
