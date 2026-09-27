import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReportInsights } from "@/features/dashboard/reports/getReportInsights";
import { InventoryAgeReport } from "@/features/dashboard/reports/InventoryAgeReport";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440)
    return `${(minutes / 60).toLocaleString("es-AR", { maximumFractionDigits: 1 })} h`;
  return `${(minutes / 1440).toLocaleString("es-AR", { maximumFractionDigits: 1 })} días`;
}

function Funnel({ insights }: { insights: ReportInsights }) {
  const max = Math.max(1, insights.funnel[0]?.count ?? 0);
  return (
    <div className="space-y-3">
      {insights.funnel.map((stage) => (
        <div
          key={stage.key}
          className="grid grid-cols-[112px_1fr_88px] items-center gap-2 text-xs sm:grid-cols-[135px_1fr_100px] sm:text-sm"
        >
          <span>{stage.label}</span>
          <div className="h-5 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm bg-primary"
              style={{
                width: `${stage.count ? Math.max(3, (stage.count / max) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="text-right tabular-nums">
            {stage.count.toLocaleString("es-AR")}
            {stage.dropPercent !== null && (
              <span className="ml-1 text-xs text-muted-foreground">
                −{Math.round(stage.dropPercent * 100)}%
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function Sources({ sources }: { sources: ReportInsights["sources"] }) {
  if (!sources.length)
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay leads en este período.
      </p>
    );
  const max = Math.max(1, ...sources.map((source) => source.leads));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Canal</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Cerrados</TableHead>
            <TableHead className="text-right">Conversión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.key}>
              <TableCell className="min-w-[150px] font-medium">
                {source.label}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(source.leads / max) * 100}%` }}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {source.leads}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {source.closed}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {source.leads
                  ? `${(source.conversion * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`
                  : "—"}
                {source.leads < 10 && (
                  <span className="block text-[11px] text-muted-foreground">
                    Muestra chica
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DemandTable({
  rows,
  silent = false,
}: {
  rows: ReportInsights["ranking"];
  silent?: boolean;
}) {
  if (!rows.length)
    return (
      <p className="text-sm text-muted-foreground">
        No hay propiedades para mostrar.
      </p>
    );
  return (
    <div className="max-h-[290px] overflow-auto">
      <Table
        className={`table-fixed ${silent ? "min-w-[320px]" : "min-w-[560px]"}`}
      >
        <TableHeader>
          <TableRow>
            <TableHead className={silent ? "w-[70%]" : "w-[36%]"}>
              Propiedad
            </TableHead>
            {!silent && (
              <>
                <TableHead className="text-right">Consultas</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Negociación</TableHead>
              </>
            )}
            <TableHead className="text-right">Días</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="py-2">
                <Link
                  href={`/dashboard/propiedades/${row.id}`}
                  title={row.title}
                  className="flex max-w-[190px] items-center gap-1 font-medium hover:text-primary hover:underline"
                >
                  <span className="min-w-0 truncate">{row.title}</span>
                  <ArrowUpRight className="size-3.5 shrink-0" />
                </Link>
                {row.city && (
                  <span
                    className="block max-w-[190px] truncate text-xs text-muted-foreground"
                    title={row.city}
                  >
                    {row.city}
                  </span>
                )}
              </TableCell>
              {!silent && (
                <>
                  <TableCell className="py-2 text-right tabular-nums">
                    {row.inquiries}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums">
                    {row.visits}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums">
                    {row.negotiations}
                  </TableCell>
                </>
              )}
              <TableCell className="py-2 text-right tabular-nums">
                {row.ageDays}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "12 meses" },
  { value: "todo", label: "Histórico" },
] as const;

export function ReportsView({
  insights,
  isAdmin,
}: {
  insights: ReportInsights;
  isAdmin: boolean;
}) {
  const { firstContact, scope } = insights;
  const selected =
    insights.periodDays === null ? "todo" : String(insights.periodDays);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Actividad comercial</h2>
        </div>
        <nav
          aria-label="Período del reporte"
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
        >
          {PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/dashboard/reportes?periodo=${option.value}`}
              aria-current={selected === option.value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${selected === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Leads captados"
          value={scope.leads.toLocaleString("es-AR")}
          detail="Cohorte del período seleccionado"
        />
        <Metric
          label="Cerrados actualmente"
          value={scope.closed.toLocaleString("es-AR")}
          detail="De los leads captados en el período"
        />
        <Metric
          label="Conversión a cierre"
          value={
            scope.leads
              ? `${((scope.closed / scope.leads) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`
              : "—"
          }
          detail={`${scope.discarded} descartados incluidos en la base`}
        />
        <Metric
          label="Tiempo hasta Contactado"
          value={formatDuration(firstContact.medianMinutes)}
          detail={`${firstContact.measured}/${firstContact.total} medidos · ${firstContact.withoutRecordedContact} sin registro`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Origen de leads"
          subtitle="Cierres actuales / leads captados en el período."
        >
          <Sources sources={insights.sources} />
        </Section>
        <Section
          title="Embudo registrado"
          subtitle="Progreso de la misma cohorte por etapas confirmadas en el historial."
        >
          <Funnel insights={insights} />
        </Section>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Cartera y demanda
          </h2>
          <p className="text-xs text-muted-foreground">
            La antigüedad de la cartera actual se muestra independientemente del
            período de leads elegido arriba.
          </p>
        </div>
        <InventoryAgeReport items={insights.inventory} asOf={insights.asOf} />
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Section
            title={
              isAdmin
                ? "Propiedades con más consultas"
                : "Propiedades con más consultas asignadas"
            }
            subtitle="Leads captados en el período seleccionado."
          >
            <DemandTable rows={insights.ranking} />
          </Section>
          <Section
            title={
              isAdmin
                ? "Sin consultas en 30 días"
                : "Sin consultas asignadas en 30 días"
            }
            subtitle={`Propiedades disponibles dadas de alta hace al menos 30 días.`}
          >
            <DemandTable rows={insights.silent} silent />
          </Section>
        </div>
      </div>
    </div>
  );
}
