import "server-only";
import Link from "next/link";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { MIN_SAMPLE, rate, type Period } from "./performance";
import { getPropertyPerformance, type PerfProperty, type PriceStat } from "./performanceData";

const PERIODS: { value: Period; label: string }[] = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "todo", label: "Todo" },
];

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const fmt = (n: number) => nf.format(n);
const dec = (n: number) => n.toFixed(1).replace(".", ",");
const pct = (v: number | null) => (v === null ? "—" : `${dec(v)}%`);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;
const usd = (n: number) => `USD ${fmt(n)}`;

function PriceLine({ label, stat }: { label: string; stat: PriceStat | null }) {
  return (
    <li className="flex min-h-9 items-center justify-between gap-4 border-b border-border-subtle py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {stat ? (
        <span className="text-right font-medium tabular-nums">
          {signed(stat.diff)}
          <span className="block text-xs font-normal text-muted-foreground">
            mediana {usd(stat.median)}/m² · {stat.n} propiedades
          </span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Sin comparables suficientes</span>
      )}
    </li>
  );
}

// Rendimiento de la propiedad: embudo, comparación con similares y
// diagnóstico. Los números son agregados de toda la inmobiliaria; la
// página ya validó la sesión antes de montar este componente.
export async function PropertyFunnelCard({
  property,
  baseHref,
  period,
}: {
  property: PerfProperty;
  baseHref: string;
  period: Period;
}) {
  const perf = await getPropertyPerformance(property, period);
  const { funnel, views, benchmarks, diagnosis } = perf;
  const { conversion, price } = benchmarks;

  const stages = [
    { label: "Exposición", value: views, unit: "vistas" },
    { label: "Interés", value: funnel.inquiries, unit: "consultas" },
    { label: "Calificados", value: funnel.qualified, unit: "contactados o más" },
    { label: "Visitas", value: funnel.visits, unit: "agendadas" },
    { label: "Negociación", value: funnel.negotiation, unit: "en negociación o cerradas" },
  ];

  const viewToInquiry = views !== null && views >= 100 ? (funnel.inquiries / views) * 100 : null;
  const rates = [
    { label: "Vistas → consulta", value: viewToInquiry, small: views === null || views < 100 },
    { label: "Consulta → calificado", value: rate(funnel.qualified, funnel.inquiries), small: funnel.inquiries < MIN_SAMPLE },
    { label: "Consulta → visita", value: rate(funnel.visits, funnel.inquiries), small: funnel.inquiries < MIN_SAMPLE },
    { label: "Visita → negociación", value: rate(funnel.negotiation, funnel.visits), small: funnel.visits < MIN_SAMPLE },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Rendimiento</CardTitle>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button key={p.value} asChild variant={p.value === period ? "secondary" : "ghost"} size="sm">
              <Link href={`${baseHref}?periodo=${p.value}`} scroll={false}>
                {p.label}
              </Link>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
          {stages.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{s.value === null ? "—" : fmt(s.value)}</dd>
              <p className="text-xs text-muted-foreground">{s.unit}</p>
            </div>
          ))}
        </dl>

        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {rates.map((r) => (
            <li
              key={r.label}
              className="flex h-9 items-center justify-between gap-4 border-b border-border-subtle text-sm last:border-0 sm:[&:nth-last-child(2)]:border-0"
            >
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium tabular-nums" title={r.small ? "Muestra chica: todavía no hay datos suficientes" : undefined}>
                {pct(r.value)}
              </span>
            </li>
          ))}
        </ul>

        {/* Comparación con similares */}
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <h3 className="text-sm font-semibold">Comparación con similares</h3>

          <ul>
            <li className="flex min-h-9 items-center justify-between gap-4 border-b border-border-subtle py-1.5 text-sm">
              <span className="text-muted-foreground">Consulta → visita en los primeros 30 días</span>
              {conversion.own && conversion.cohortVisitRate !== null ? (
                <span className="text-right font-medium tabular-nums">
                  {pct(conversion.own.visitRate)} <span className="font-normal text-muted-foreground">vs</span> {pct(conversion.cohortVisitRate)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    similares: {conversion.cohortProperties} propiedades, {conversion.cohortInquiries} consultas
                  </span>
                </span>
              ) : (
                <span className="max-w-[60%] text-right text-xs text-muted-foreground">{conversion.note}</span>
              )}
            </li>
          </ul>

          {price ? (
            <>
              <p className="text-sm">
                <span className="font-medium tabular-nums">{usd(price.usdPerM2)}/m²</span>{" "}
                <span className="text-muted-foreground">
                  ({price.basis === "covered" ? "superficie cubierta" : "superficie total"})
                </span>
              </p>
              <ul>
                <PriceLine label="vs. publicadas similares" stat={price.active} />
                {property.operation_type?.toLowerCase() === "venta" && (
                  <PriceLine label="vs. cierres reales (24 meses)" stat={price.closings} />
                )}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Falta precio, superficie, tipo o ciudad para calcular el precio por m².
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Similares: misma operación, tipo y ciudad. Para conversión, precio dentro de ±25%; para precio por m²,
            superficie dentro de ±40%. Es tu propia cartera, no el mercado.
          </p>
        </div>

        {/* Cambios de precio */}
        {perf.priceChanges.length > 0 && (
          <div className="space-y-2 border-t border-border-subtle pt-4">
            <h3 className="text-sm font-semibold">Cambios de precio</h3>
            <ul>
              {perf.priceChanges.map((c) => (
                <li key={c.at} className="flex min-h-9 items-center justify-between gap-4 border-b border-border-subtle py-1.5 text-sm last:border-0">
                  <span>
                    <span className="tabular-nums">{new Date(c.at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {c.fromCurrency} {fmt(c.from)} → {c.currency} {fmt(c.to)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-medium tabular-nums">{c.pct === null ? "cambió la moneda" : signed(c.pct)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.effect
                        ? `${c.effect.days} d antes → después: ${c.effect.inquiriesBefore} → ${c.effect.inquiriesAfter} consultas${
                            c.effect.viewsBefore !== null && c.effect.viewsAfter !== null
                              ? `, ${c.effect.viewsBefore} → ${c.effect.viewsAfter} vistas`
                              : ""
                          }`
                        : `Todavía no pasaron ${14} días para medir el efecto`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              El historial empieza cuando se activó el registro de precios; los cambios anteriores no figuran.
            </p>
          </div>
        )}

        {/* Diagnóstico */}
        {diagnosis && (
          <div className="space-y-2 border-t border-border-subtle pt-4">
            <h3 className="text-sm font-semibold">Qué mirar</h3>
            <ul className="space-y-2">
              {diagnosis.map((d) => (
                <li key={d.title} className="flex items-start gap-3 text-sm">
                  <StatusBadge tone={d.severity === "alta" ? "warning" : d.severity === "media" ? "info" : "neutral"}>
                    {d.severity === "info" ? "Info" : d.severity === "alta" ? "Alta" : "Media"}
                  </StatusBadge>
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-muted-foreground">{d.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {perf.viewsNote && <>{perf.viewsNote} </>}
          Un porcentaje aparece con al menos {MIN_SAMPLE} consultas (100 vistas para vistas → consulta). Una persona que
          consultó dos veces cuenta una. Calificado es quien pasó de &quot;Nuevo&quot; y no quedó solo en
          &quot;Descartado&quot;.
        </p>
      </CardContent>
    </Card>
  );
}
