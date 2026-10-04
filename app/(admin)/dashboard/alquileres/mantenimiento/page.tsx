import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { daysBetween, formatDate, money } from "@/features/rentals/logic";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { MAINTENANCE_STATUS, type MaintenanceItem } from "@/features/rentals/maintenance";

type Row = MaintenanceItem & {
  contract_id: string;
  contract: { currency: string; properties: { title: string } | null; tenant: { full_name: string } | null } | null;
};

const PRIORITY_ORDER = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 } as const;
const PRIORITY_LABELS = { URGENTE: "Urgente", ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" } as const;
const PAYER_LABELS = { INQUILINO: "inquilino", PROPIETARIO: "propietario", INMOBILIARIA: "inmobiliaria" } as const;
const FILTERS = [
  { value: "abiertos", label: "Abiertos" },
  { value: "cerrados", label: "Cerrados" },
  { value: "todos", label: "Todos" },
] as const;

// /dashboard/alquileres/mantenimiento: reclamos de todas las propiedades.
// Se cargan y editan desde la pestaña Mantenimiento de cada contrato.
export default async function MantenimientoPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { estado } = await searchParams;
  const filter = FILTERS.some((f) => f.value === estado) ? estado! : "abiertos";
  const today = ymdInAppTz();

  const { data } = await supabase
    .from("rental_maintenance")
    .select("id, contract_id, title, description, priority, status, payer, provider, cost, reported_at, resolved_at, charge_id, settlement_id, contract:rental_contracts(currency, properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name))")
    .order("reported_at", { ascending: false });

  const all = (data ?? []) as unknown as Row[];
  const isOpen = (item: Row) => item.status === "ABIERTO" || item.status === "EN_CURSO";
  const open = all.filter(isOpen);
  const rows = (filter === "abiertos" ? open : filter === "cerrados" ? all.filter((item) => !isOpen(item)) : all)
    .sort((a, b) => filter === "abiertos"
      ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.reported_at.localeCompare(b.reported_at)
      : 0);
  const urgent = open.filter((item) => item.priority === "URGENTE" || item.priority === "ALTA").length;
  const oldest = open.length ? Math.max(...open.map((item) => daysBetween(item.reported_at, today))) : 0;
  const resolvedThisMonth = all.filter((item) => item.status === "RESUELTO" && item.resolved_at && item.resolved_at.slice(0, 7) === today.slice(0, 7)).length;

  return (
    <Page>
      <PageHeader title="Alquileres" description="Reclamos y reparaciones de las propiedades administradas" />
      <RentalsNav />

      <StatStrip>
        <Stat label="Abiertos" value={open.length} tone={open.length ? "warning" : undefined} detail={open.length ? "Sin resolver" : "Ninguno pendiente"} />
        <Stat label="Urgentes o alta prioridad" value={urgent} tone={urgent ? "danger" : undefined} detail="Entre los abiertos" />
        <Stat label="El más antiguo" value={open.length ? `${oldest} días` : "-"} detail={open.length ? "Desde que se reportó" : "Sin reclamos abiertos"} />
        <Stat label="Resueltos este mes" value={resolvedThisMonth} detail="Cerrados como resueltos" />
      </StatStrip>

      <nav aria-label="Filtrar reclamos" className="flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "abiertos" ? "/dashboard/alquileres/mantenimiento" : `/dashboard/alquileres/mantenimiento?estado=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {filter === "abiertos"
            ? "No hay reclamos abiertos. Los nuevos se cargan desde la pestaña Mantenimiento de cada contrato."
            : "No hay reclamos para mostrar."}
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((item) => {
            const status = MAINTENANCE_STATUS[item.status];
            const age = daysBetween(item.reported_at, item.resolved_at ?? today);
            return (
              <li key={item.id}>
                <Link
                  href={`/dashboard/alquileres/${item.contract_id}?tab=mantenimiento`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_auto]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.contract?.properties?.title ?? "Contrato"} · {item.contract?.tenant?.full_name ?? "sin inquilino"}
                    </span>
                  </span>
                  <span className="hidden min-w-0 text-xs text-muted-foreground md:block">
                    <span className="block truncate">{item.provider ?? "Sin proveedor"}{item.payer ? ` · a cargo de ${PAYER_LABELS[item.payer]}` : ""}</span>
                    <span className="block">Reportado {formatDate(item.reported_at)} ({age} días)</span>
                  </span>
                  <span className="hidden text-right tabular-nums md:block">
                    {item.cost != null ? money(item.cost, item.contract?.currency ?? "ARS") : <span className="text-muted-foreground">Sin costo</span>}
                  </span>
                  <span className="flex items-center justify-end gap-2">
                    <span className={cn("hidden text-xs sm:inline", item.priority === "URGENTE" || item.priority === "ALTA" ? "font-medium text-danger" : "text-muted-foreground")}>
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
