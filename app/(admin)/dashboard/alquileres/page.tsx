import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle, AlertTriangle, CalendarClock, TrendingUp, FileText } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  ADJUSTMENT_ALERT_DAYS,
  CONTRACT_STATUS_LABELS,
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
      tone: "text-red-700 bg-red-50",
    },
    {
      icon: CalendarClock,
      label: `Vencen en ≤ ${EXPIRY_ALERT_DAYS} días`,
      value: expiring.length,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      icon: TrendingUp,
      label: `Ajuste en ≤ ${ADJUSTMENT_ALERT_DAYS} días`,
      value: adjusting.length,
      tone: "text-blue-700 bg-blue-50",
    },
    {
      icon: FileText,
      label: "Contratos activos",
      value: active.length,
      tone: "text-emerald-700 bg-emerald-50",
    },
  ];

  return (
    <div className="theme-tn flex flex-col w-full max-w-[1600px] mx-auto px-4 py-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-serif font-semibold tracking-tight text-foreground">
            Alquileres
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Contratos, cobranzas y liquidaciones.
          </p>
        </div>
        <Button asChild className="rounded-sm shadow-none">
          <Link href="/dashboard/alquileres/nuevo">
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Nuevo contrato</span>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {alerts.map((a) => (
          <div
            key={a.label}
            className="bg-card border border-border rounded-md p-4 flex items-center gap-3"
          >
            <div className={`p-2.5 rounded-full ${a.tone}`}>
              <a.icon className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{a.label}</p>
              <p className="text-2xl font-serif font-semibold">{a.value}</p>
            </div>
          </div>
        ))}
      </div>

      {(overdue.length > 0 || expiring.length > 0 || adjusting.length > 0) && (
        <section className="bg-card rounded-md border border-border overflow-hidden">
          <div className="py-3 px-4 border-b border-border">
            <h3 className="font-serif font-semibold text-foreground">Requiere acción</h3>
          </div>
          <ul className="divide-y divide-border text-sm">
            {overdue.map((p) => {
              const c = byId.get(p.contract_id);
              return (
                <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="size-4 text-red-600 shrink-0" />
                    <Link href={`/dashboard/alquileres/${p.contract_id}`} className="font-medium hover:underline truncate">
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
              <li key={`adj-${c.id}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="size-4 text-blue-600 shrink-0" />
                  <Link href={`/dashboard/alquileres/${c.id}`} className="font-medium hover:underline truncate">
                    {c.properties?.title ?? "Contrato"}
                  </Link>
                  <span className="text-muted-foreground truncate">
                    · ajuste {c.adjustment_index} el {formatDate(c.next_adjustment_date)}
                  </span>
                </span>
              </li>
            ))}
            {expiring.map((c) => (
              <li key={`exp-${c.id}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <CalendarClock className="size-4 text-amber-600 shrink-0" />
                  <Link href={`/dashboard/alquileres/${c.id}`} className="font-medium hover:underline truncate">
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

      <section className="bg-card rounded-md border border-border overflow-hidden">
        <div className="py-3 px-4 border-b border-border">
          <h3 className="font-serif font-semibold text-foreground">Contratos</h3>
        </div>
        {contracts.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
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
                      <span className="ml-2 text-[11px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full">
                        {overdueByContract.get(c.id)} en mora
                      </span>
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
                    <span className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
                      {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
