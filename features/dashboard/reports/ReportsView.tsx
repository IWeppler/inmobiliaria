import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import type {
  LostReasonCount,
  ReportInsights,
} from "@/features/dashboard/reports/getReportInsights";
import { GRAIN_NOUN } from "@/features/dashboard/reports/leadTrend";
import { LeadTrendChart } from "@/features/dashboard/reports/LeadTrendChart";
import { ListingConversionReport } from "@/features/dashboard/reports/ListingConversionReport";
import { DemandTable } from "@/features/dashboard/reports/DemandTable";
import { ExportCsvButton } from "@/features/dashboard/reports/ExportCsvButton";
import { InventoryAgeReport } from "@/features/dashboard/reports/InventoryAgeReport";
import { PeriodNav } from "@/features/dashboard/reports/PeriodNav";
import { ReportSection as Section } from "@/features/dashboard/reports/ReportSection";
import { SourceCostForm } from "@/features/dashboard/reports/SourceCostForm";
import {
  MIN_RESPONSES,
  ON_TIME_MINUTES,
  type ResponseGroup,
} from "@/features/dashboard/reports/responseTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

// Por debajo de este tamaño de cohorte la conversión de una fuente no es confiable.
const MIN_SOURCE_LEADS = 10;
// Consultas sin responder que se muestran sin desplegar la lista completa.
const WAITING_PREVIEW = 6;

type Delta = {
  text: string;
  // good: la variación es favorable; null = sin cambio apreciable.
  good: boolean | null;
  up: boolean;
};

function relativeDelta(
  current: number,
  previous: number | null | undefined,
): Delta | null {
  if (previous === null || previous === undefined) return null;
  if (previous === 0)
    return current > 0 ? { text: "nuevo", good: true, up: true } : null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) return { text: "0 %", good: null, up: true };
  const up = change > 0;
  return {
    text: `${up ? "+" : "−"}${Math.abs(change * 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })} %`,
    good: up,
    up,
  };
}

// Variación en puntos porcentuales, para métricas que ya son un porcentaje.
function pointsDelta(
  current: number | null,
  previous: number | null,
): Delta | null {
  if (current === null || previous === null) return null;
  const change = (current - previous) * 100;
  if (Math.abs(change) < 0.05) return { text: "0 pp", good: null, up: true };
  const up = change > 0;
  return {
    text: `${up ? "+" : "−"}${Math.abs(change).toLocaleString("es-AR", { maximumFractionDigits: 1 })} pp`,
    good: up,
    up,
  };
}

function DeltaBadge({ delta, versus }: { delta: Delta; versus: string }) {
  const tone =
    delta.good === null
      ? "bg-muted text-muted-foreground"
      : delta.good
        ? "bg-success-bg text-success"
        : "bg-danger-bg text-danger";
  const Icon = delta.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums ${tone}`}
      title={versus}
    >
      {delta.good !== null && <Icon className="size-3.5" aria-hidden />}
      {delta.text}
      <span className="sr-only"> {versus}</span>
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  delta,
  versus,
}: {
  label: string;
  value: string;
  detail: string;
  delta?: Delta | null;
  versus?: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-lg border border-border bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          {delta && versus && <DeltaBadge delta={delta} versus={versus} />}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

// Minutos hábiles (jornada de 9 hs): se informan en horas y, desde una
// jornada completa, en días hábiles.
function formatBusiness(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 540)
    return `${(minutes / 60).toLocaleString("es-AR", { maximumFractionDigits: 1 })} h`;
  return `${(minutes / 540).toLocaleString("es-AR", { maximumFractionDigits: 1 })} días háb.`;
}

function ResponseTable({
  groups,
  firstColumn,
}: {
  groups: ResponseGroup[];
  firstColumn: string;
}) {
  if (!groups.length)
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No hay consultas entrantes en este período.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{firstColumn}</TableHead>
            <TableHead className="text-right">Consultas</TableHead>
            <TableHead className="text-right">Sin respuesta</TableHead>
            <TableHead className="text-right">Mediana</TableHead>
            <TableHead className="text-right">
              En {ON_TIME_MINUTES / 60} h háb.
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.key}>
              <TableCell className="font-medium">{g.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {g.total}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${g.pending > 0 ? "font-medium text-warning" : ""}`}
              >
                {g.pending}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBusiness(g.medianMinutes)}
                {g.medianMinutes === null &&
                  g.answered > 0 &&
                  g.answered < MIN_RESPONSES && (
                    <span className="block text-xs text-muted-foreground">
                      Muestra chica
                    </span>
                  )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {g.onTimePct === null
                  ? "—"
                  : `${g.onTimePct.toLocaleString("es-AR", { maximumFractionDigits: 0 })} %`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WaitingItem({
  item,
}: {
  item: ReportInsights["response"]["waiting"][number];
}) {
  return (
    <li className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
      <Link
        href={`/dashboard/leads/${item.id}`}
        className="min-w-0 truncate font-medium underline decoration-border underline-offset-4 hover:decoration-current"
      >
        {item.name}
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground">
        {item.source} · {formatBusiness(item.waitingMinutes)}
      </span>
    </li>
  );
}

function Waiting({ items }: { items: ReportInsights["response"]["waiting"] }) {
  if (!items.length) return null;
  const preview = items.slice(0, WAITING_PREVIEW);
  const rest = items.slice(WAITING_PREVIEW);
  const grid = "grid gap-2 sm:grid-cols-2 xl:grid-cols-3";
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="mb-3 text-sm font-medium">
        Esperando respuesta{" "}
        <span className="font-normal text-muted-foreground">
          ({items.length})
        </span>
      </p>
      <ul className={grid}>
        {preview.map((item) => (
          <WaitingItem key={item.id} item={item} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-3.5 transition-transform group-open:rotate-180"
              aria-hidden
            />
            <span className="group-open:hidden">Ver {rest.length} más</span>
            <span className="hidden group-open:inline">Ver menos</span>
          </summary>
          <ul className={`${grid} mt-2`}>
            {rest.map((item) => (
              <WaitingItem key={item.id} item={item} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Funnel({ insights }: { insights: ReportInsights }) {
  const max = Math.max(1, insights.funnel[0]?.count ?? 0);
  // Etapa con la mayor caída respecto de la anterior (si hay alguna real).
  let worstIndex = -1;
  insights.funnel.forEach((stage, index) => {
    const drop = stage.dropPercent ?? 0;
    if (drop > 0 && drop > (insights.funnel[worstIndex]?.dropPercent ?? 0))
      worstIndex = index;
  });
  const worst = worstIndex > 0 ? insights.funnel[worstIndex] : null;
  if (!insights.funnel[0]?.count)
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Todavía no hay leads en este período.
      </p>
    );
  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <ol className="space-y-3.5">
        {insights.funnel.map((stage) => {
          const isWorst = worst?.key === stage.key;
          return (
            <li key={stage.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{stage.label}</span>
                <span className="tabular-nums">
                  <span className="font-medium">
                    {stage.count.toLocaleString("es-AR")}
                  </span>
                  {stage.dropPercent !== null && (
                    <span
                      className={`ml-2 text-xs ${isWorst ? "font-semibold text-warning" : "text-muted-foreground"}`}
                    >
                      −{Math.round(stage.dropPercent * 100)} %
                    </span>
                  )}
                </span>
              </div>
              <div
                aria-hidden
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={`h-full rounded-full ${isWorst ? "bg-warning" : "bg-primary"}`}
                  style={{
                    width: `${stage.count ? Math.max(2, (stage.count / max) * 100) : 0}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      {worst && (
        <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[13px] text-warning">
          <span className="font-semibold">Mayor caída:</span> de{" "}
          {insights.funnel[worstIndex - 1].label} a {worst.label} (
          {Math.round((worst.dropPercent ?? 0) * 100)} %).
        </p>
      )}
    </div>
  );
}

function LostReasons({
  reasons,
  unregistered,
}: {
  reasons: LostReasonCount[];
  unregistered: number;
}) {
  const registered = reasons.reduce((sum, reason) => sum + reason.count, 0);
  if (!registered)
    return (
      <div className="flex flex-1 flex-col justify-center rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Todavía no hay motivos registrados.
        </p>
        <p className="mt-1">
          Desde ahora, al descartar un lead se pide el motivo. Acá vas a ver qué
          hace perder más operaciones.
        </p>
        {unregistered > 0 && (
          <p className="mt-2">
            {unregistered} descartados del período son anteriores y no tienen
            motivo.
          </p>
        )}
      </div>
    );
  const max = Math.max(...reasons.map((reason) => reason.count));
  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <ol className="space-y-3.5">
        {reasons.map((reason) => (
          <li key={reason.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{reason.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{reason.count}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {Math.round((reason.count / registered) * 100)} %
                </span>
              </span>
            </div>
            <div
              aria-hidden
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(2, (reason.count / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
      {unregistered > 0 && (
        <p className="text-[13px] text-muted-foreground">
          Además, {unregistered} descartados sin motivo registrado (anteriores a
          que se empezara a pedir).
        </p>
      )}
    </div>
  );
}

const usd = (n: number) =>
  `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;

function Sources({
  sources,
  showCosts,
  unattributed,
}: {
  sources: ReportInsights["sources"];
  showCosts: boolean;
  unattributed: number;
}) {
  if (!sources.length)
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Todavía no hay leads en este período.
      </p>
    );
  const max = Math.max(1, ...sources.map((source) => source.leads));
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Visitas</TableHead>
              <TableHead className="text-right">Negociación</TableHead>
              <TableHead className="text-right">Cerrados</TableHead>
              <TableHead className="text-right">Conversión</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              {showCosts && (
                <>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Costo / cierre</TableHead>
                  <TableHead className="text-right">Retorno</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => {
              const cost = source.costUsd ?? 0;
              return (
                <TableRow key={source.key}>
                  <TableCell className="w-[28%] min-w-[180px] font-medium">
                    {source.label}
                    <div
                      aria-hidden
                      className="mt-1.5 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-muted"
                    >
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
                    {source.visits}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {source.negotiations}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {source.closed}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {source.leads
                      ? `${(source.conversion * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`
                      : "—"}
                    {source.leads < MIN_SOURCE_LEADS && (
                      <span className="block text-xs text-muted-foreground">
                        Muestra chica
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {source.revenueUsd > 0 ? usd(source.revenueUsd) : "—"}
                  </TableCell>
                  {showCosts && (
                    <>
                      <TableCell className="text-right tabular-nums">
                        {cost > 0 ? usd(cost) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cost > 0 && source.closed > 0
                          ? usd(cost / source.closed)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${cost > 0 ? (source.revenueUsd >= cost ? "text-success" : "text-danger") : ""}`}
                      >
                        {cost > 0 ? (
                          <>
                            {source.revenueUsd >= cost ? "+" : "−"}
                            {usd(Math.abs(source.revenueUsd - cost))}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {unattributed > 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {usd(unattributed)} de comisión no se pudo atribuir a ninguna fuente.
        </p>
      )}
    </>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ReportsView({
  insights,
  isAdmin,
}: {
  insights: ReportInsights;
  isAdmin: boolean;
}) {
  const { response, scope, previous } = insights;
  const selected =
    insights.periodDays === null ? "todo" : String(insights.periodDays);
  const versus = `vs. ${insights.periodDays} días previos`;
  const conversion = scope.leads ? scope.closed / scope.leads : null;
  const previousConversion = previous?.leads
    ? previous.closed / previous.leads
    : null;
  // Las columnas de costo solo aportan si hay al menos un costo cargado.
  const showCosts =
    isAdmin && insights.sources.some((source) => (source.costUsd ?? 0) > 0);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <SectionHeading
          title="Actividad comercial"
          description={
            previous
              ? `Variación ${versus}.`
              : "Sin comparación en el período histórico."
          }
          action={<PeriodNav selected={selected} />}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Leads captados"
            value={scope.leads.toLocaleString("es-AR")}
            detail="Cohorte del período seleccionado"
            delta={relativeDelta(scope.leads, previous?.leads)}
            versus={versus}
          />
          <Metric
            label="Cerrados"
            value={scope.closed.toLocaleString("es-AR")}
            detail="De los leads captados, a hoy"
            delta={relativeDelta(scope.closed, previous?.closed)}
            versus={versus}
          />
          <Metric
            label="Conversión a cierre"
            value={
              conversion === null
                ? "—"
                : `${(conversion * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`
            }
            detail={`${scope.discarded} descartados incluidos en la base`}
            delta={pointsDelta(conversion, previousConversion)}
            versus={versus}
          />
          <Metric
            label="Primera respuesta (mediana)"
            value={formatBusiness(response.overall.medianMinutes)}
            detail={`${response.overall.answered} de ${response.overall.total} respondidas, ${response.overall.pending} pendientes`}
          />
        </div>

        <Section
          title="Evolución de leads"
          subtitle={`Leads captados por ${GRAIN_NOUN[insights.trend.grain]}, según su estado actual.`}
        >
          <LeadTrendChart trend={insights.trend} />
        </Section>

        {/* El embudo muestra dónde se caen los leads; los motivos, por qué. */}
        <div className="grid gap-4 xl:grid-cols-2">
          <Section
            title="Embudo de conversión"
            subtitle="Avance de la misma cohorte por etapas confirmadas en el historial."
          >
            <Funnel insights={insights} />
          </Section>
          <Section
            title="Motivos de pérdida"
            subtitle="Leads de la cohorte que hoy están descartados."
          >
            <LostReasons
              reasons={insights.lostReasons}
              unregistered={insights.lostUnregistered}
            />
          </Section>
        </div>

        <Section
          title="Origen de leads"
          subtitle="Cierres actuales sobre leads captados en el período, por canal."
          notes={
            <>
              Comisión: ventas cerradas en el período, atribuidas al lead que
              cerró la operación (si ninguno figura cerrado, al último que llegó
              a negociación).
              {isAdmin &&
                " Retorno = comisión menos costo cargado de la fuente en el período. Las ventas del período pueden venir de leads de períodos anteriores."}
            </>
          }
          action={
            <ExportCsvButton
              filename="origen-de-leads.csv"
              header={[
                "Canal",
                "Leads",
                "Visitas",
                "Negociaciones",
                "Cerrados",
                "Conversión (%)",
                "Comisión (USD)",
                ...(isAdmin ? ["Costo (USD)"] : []),
              ]}
              rows={insights.sources.map((source) => [
                source.label,
                source.leads,
                source.visits,
                source.negotiations,
                source.closed,
                Number((source.conversion * 100).toFixed(1)),
                Math.round(source.revenueUsd),
                ...(isAdmin ? [Math.round(source.costUsd ?? 0)] : []),
              ])}
            />
          }
        >
          <Sources
            sources={insights.sources}
            showCosts={showCosts}
            unattributed={insights.unattributedRevenueUsd}
          />
          {isAdmin && (
            <details className="group mt-5 border-t border-border pt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden
                />
                Cargar costo mensual de una fuente
                {!showCosts && (
                  <span className="font-normal text-muted-foreground">
                    para ver costo y retorno por canal
                  </span>
                )}
              </summary>
              <div className="pt-4">
                <SourceCostForm />
              </div>
            </details>
          )}
        </Section>

        <Section
          title="Tiempo de primera respuesta"
          subtitle="Consultas entrantes por formulario, WhatsApp o alertas."
          notes="Cuenta lunes a sábado de 9 a 18 hs. La respuesta es la primera nota o gestión del asesor. Las consultas cargadas a mano y las reservas de visita no se miden."
        >
          <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <ResponseTable groups={response.byAgent} firstColumn="Asesor" />
            <ResponseTable groups={response.bySource} firstColumn="Fuente" />
          </div>
          <Waiting items={response.waiting} />
        </Section>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Cartera y demanda"
          description="La antigüedad de la cartera no depende del período elegido arriba."
        />
        <InventoryAgeReport items={insights.inventory} asOf={insights.asOf} />
        <Section
          title="Vistas contra consultas"
          subtitle="Cada punto es una propiedad publicada, desde su alta."
          notes={
            <>
              Vistas: contador acumulado de la ficha en el sitio. Consultas:
              contactos únicos (mismo teléfono o email cuenta una vez). “Se ven
              pero no consultan” usa la misma regla que el diagnóstico de cada
              propiedad: 100 vistas o más y menos de 1 consulta cada 200. Las
              publicadas hace menos de 14 días no se evalúan.
            </>
          }
        >
          <ListingConversionReport data={insights.listings} />
        </Section>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
            subtitle={`${insights.silent.length} disponibles, dadas de alta hace 30 días o más.`}
          >
            <DemandTable rows={insights.silent} silent />
          </Section>
        </div>
      </section>
    </div>
  );
}
