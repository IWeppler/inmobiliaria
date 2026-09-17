import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, AlertTriangle, CalendarClock, TrendingUp, FileText } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Button } from "@/shared/components/ui/button";
import { Page, PageHeader } from "@/shared/components/PageShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  ADJUSTMENT_ALERT_DAYS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  EXPIRY_ALERT_DAYS,
  daysBetween,
  formatDate,
  money,
} from "@/features/rentals/logic";

type ContractRow = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  next_adjustment_date: string | null;
  adjustment_index: string;
  properties: { title: string } | null;
  owner: { full_name: string } | null;
  tenant: { full_name: string } | null;
};

// Tier 4 — /dashboard/alquileres: contratos + alertas (vencimientos,
// ajustes, mora). RLS: agente ve los suyos, admin todos.
export default async function AlquileresPage() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = ymdInAppTz();

  const [{ data: contractsRaw }, { data: overdueRaw }] = await Promise.all([
    supabase
      .from("rental_contracts")
      .select(
        "id, status, start_date, end_date, rent_amount, currency, next_adjustment_date, adjustment_index, properties(title), owner:rental_contacts!rental_contracts_owner_id_fkey(full_name), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name)"
      )
      .order("status")
      .order("end_date"),
    supabase
      .from("rental_payments")
      .select("id, contract_id, period, due_date, amount, currency")
      .is("paid_at", null)
      .lt("due_date", today)
      .order("due_date"),
  ]);

  const contracts = (contractsRaw ?? []) as unknown as ContractRow[];
  const overdue = (overdueRaw ?? []) as {
    id: string;
    contract_id: string;
    period: string;
    due_date: string;
    amount: number;
    currency: string;
  }[];
  const byId = new Map(contracts.map((c) => [c.id, c]));

  const active = contracts.filter((c) => c.status === "ACTIVO");
  const expiring = active.filter(
    (c) => daysBetween(today, c.end_date) <= EXPIRY_ALERT_DAYS
  );
  const adjusting = active.filter(
    (c) =>
      c.next_adjustment_date &&
      daysBetween(today, c.next_adjustment_date) <= ADJUSTMENT_ALERT_DAYS
  );
  const overdueByContract = new Map<string, number>();
  for (const p of overdue) {
    overdueByContract.set(p.contract_id, (overdueByContract.get(p.contract_id) ?? 0) + 1);
  }

  const alerts = [
    {
      icon: AlertTriangle,
      label: "Cuotas vencidas",
      value: overdue.length,
      tone: "text-danger",
    },
    {
      icon: CalendarClock,
      label: `Vencen en ≤ ${EXPIRY_ALERT_DAYS} días`,
      value: expiring.length,
      tone: "text-warning",
    },
    {
      icon: TrendingUp,
      label: `Ajuste en ≤ ${ADJUSTMENT_ALERT_DAYS} días`,
      value: adjusting.length,
      tone: "text-info",
    },
    {
      icon: FileText,
      label: "Contratos activos",
      value: active.length,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Alquileres"
        description="Contratos, cobranzas y liquidaciones."
        actions={
          <Button asChild>
            <Link href="/dashboard/alquileres/nuevo">
              <Plus />
              Nuevo contrato
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {alerts.map((a) => (
          <div
            key={a.label}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-xs font-medium text-muted-foreground">{a.label}</span>
            {/* El color solo aparece cuando hay algo que atender */}
            <span className={`text-2xl font-semibold tracking-tight ${a.value > 0 ? a.tone : "text-foreground"}`}>
              {a.value}
            </span>
          </div>
        ))}
      </div>

      {(overdue.length > 0 || expiring.length > 0 || adjusting.length > 0) && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold tracking-tight">Requiere acción</h2>
          </div>
          <ul className="divide-y divide-border-subtle text-sm">
            {overdue.map((p) => {
              const c = byId.get(p.contract_id);
              return (
                <li key={p.id} className="flex h-10 items-center justify-between gap-3 px-4">
                  <span className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="size-4 shrink-0 text-danger" />
                    <Link href={`/dashboard/alquileres/${p.contract_id}`} className="truncate font-medium underline-offset-4 hover:underline">
                      {c?.properties?.title ?? "Contrato"}
                    </Link>
                    <span className="text-muted-foreground truncate">
                      · {c?.tenant?.full_name} · cuota vencida el {formatDate(p.due_date)}
                    </span>
                  </span>
                  <span className="tabular-nums shrink-0">{money(p.amount, p.currency)}</span>
                </li>
              );
            })}
            {adjusting.map((c) => (
              <li key={`adj-${c.id}`} className="flex h-10 items-center justify-between gap-3 px-4">
                <span className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="size-4 shrink-0 text-info" />
                  <Link href={`/dashboard/alquileres/${c.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                    {c.properties?.title ?? "Contrato"}
                  </Link>
                  <span className="text-muted-foreground truncate">
                    · ajuste {c.adjustment_index} el {formatDate(c.next_adjustment_date)}
                  </span>
                </span>
              </li>
            ))}
            {expiring.map((c) => (
              <li key={`exp-${c.id}`} className="flex h-10 items-center justify-between gap-3 px-4">
                <span className="flex items-center gap-2 min-w-0">
                  <CalendarClock className="size-4 shrink-0 text-warning" />
                  <Link href={`/dashboard/alquileres/${c.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                    {c.properties?.title ?? "Contrato"}
                  </Link>
                  <span className="text-muted-foreground truncate">
                    · vence el {formatDate(c.end_date)} ({daysBetween(today, c.end_date)} días)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold tracking-tight">Contratos</h2>
        </div>
        {contracts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Todavía no hay contratos. Creá el primero con &ldquo;Nuevo contrato&rdquo;.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="hidden md:table-cell">Inquilino</TableHead>
                <TableHead className="hidden lg:table-cell">Propietario</TableHead>
                <TableHead>Canon</TableHead>
                <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/alquileres/${c.id}`} className="hover:underline hover:text-primary">
                      {c.properties?.title ?? "—"}
                    </Link>
                    {overdueByContract.get(c.id) && (
                      <StatusBadge tone="danger" className="ml-2">
                        {overdueByContract.get(c.id)} en mora
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.tenant?.full_name}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {c.owner?.full_name}
                  </TableCell>
                  <TableCell className="tabular-nums">{money(c.rent_amount, c.currency)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(c.start_date)} → {formatDate(c.end_date)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>
                      {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </Page>
  );
}
