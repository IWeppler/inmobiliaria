import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, AlertTriangle } from "lucide-react";
import type { ReportData } from "@/features/dashboard/reports/getReportData";
import { REPORT_THRESHOLDS } from "@/features/dashboard/reports/getReportData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

function fmtMoney(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  })}`;
}

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
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// E1.5 — Funnel. Una sola serie (una etapa tras otra), un solo tono: la
// magnitud la lleva el largo de la barra, la etiqueta y el % respecto a la
// etapa anterior van como texto, no como color.
// Las etapas difieren en órdenes de magnitud (miles de vistas vs. unidades
// de cierres), así que el largo va en escala logarítmica: todas las barras
// se ven y la lectura fina la dan los números.
function Funnel({ stages }: { stages: ReportData["funnel"] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const scale = (n: number) =>
    max <= 1 ? 0 : (Math.log10(n + 1) / Math.log10(max + 1)) * 100;
  return (
    <ol className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const pct =
          prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        const width = s.count > 0 ? Math.max(3, scale(s.count)) : 0;
        return (
          <li key={s.key} className="grid grid-cols-[130px_1fr_auto] items-center gap-3">
            <span className="text-sm text-foreground">{s.label}</span>
            <div className="h-5 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full bg-primary rounded-r-sm"
                style={{ width: `${width}%` }}
                title={`${s.label}: ${s.count}`}
              />
            </div>
            <span className="text-sm tabular-nums text-foreground min-w-[110px] text-right">
              {s.count.toLocaleString("es-AR")}
              {pct !== null && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({pct}%)
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// E1.6 — Ingresos mes vs. mes anterior, agrupado por moneda (no se mezcla
// USD con ARS en un mismo número).
function Revenue({ revenue }: { revenue: ReportData["revenue"] }) {
  const { current, previous } = revenue;
  const currencies = Array.from(
    new Set([
      ...Object.keys(current.byCurrency),
      ...Object.keys(previous.byCurrency),
    ])
  );

  const Trend = ({ now, before }: { now: number; before: number }) => {
    if (before === 0 && now === 0)
      return <Minus className="size-3.5 text-muted-foreground" />;
    if (now >= before)
      return <ArrowUpRight className="size-3.5 text-success" />;
    return <ArrowDownRight className="size-3.5 text-danger" />;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[current, previous].map((m) => (
        <div
          key={m.label}
          className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3"
        >
          <span className="text-xs font-medium text-muted-foreground">
            {m.label}
          </span>
          {currencies.length === 0 ? (
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              —
            </span>
          ) : (
            currencies.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  {fmtMoney(c, m.byCurrency[c] ?? 0)}
                </span>
                {m === current && (
                  <Trend
                    now={current.byCurrency[c] ?? 0}
                    before={previous.byCurrency[c] ?? 0}
                  />
                )}
              </div>
            ))
          )}
          <span className="text-xs text-muted-foreground">
            {m.deals} {m.deals === 1 ? "operación cerrada" : "operaciones cerradas"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReportsView({ data }: { data: ReportData }) {
  const { MIN_VIEWS, LOW_RATIO } = REPORT_THRESHOLDS;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Propiedades activas", value: data.totals.activeProperties },
          { label: "Leads abiertos", value: data.totals.openLeads },
          {
            label: "Operaciones cerradas (histórico)",
            value: data.totals.closedDealsAllTime,
          },
        ].map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="text-xs font-medium text-muted-foreground">
              {t.label}
            </span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              {t.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Funnel de conversión"
          subtitle="Vistas → Leads → Visita agendada → Cerrado. Porcentaje respecto a la etapa anterior; barras en escala logarítmica."
        >
          <Funnel stages={data.funnel} />
        </Section>

        <Section
          title="Ingresos"
          subtitle="Según la fecha en que la propiedad pasó a Vendida / Alquilada."
        >
          <Revenue revenue={data.revenue} />
        </Section>
      </div>

      <Section
        title="Propiedades con bajo ratio de consultas"
        subtitle={`Activas con ≥ ${MIN_VIEWS} vistas y menos de ${
          LOW_RATIO * 100
        } % de leads por vista. Señal de posible problema de precio o fotos.`}
      >
        {data.lowRatio.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna propiedad por debajo del umbral.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="text-right">Vistas</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lowRatio.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/propiedades/${p.id}`}
                      className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                    >
                      <AlertTriangle className="size-3.5 shrink-0 text-warning" />
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.views}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.leads}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(p.ratio * 100).toFixed(1)} %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
