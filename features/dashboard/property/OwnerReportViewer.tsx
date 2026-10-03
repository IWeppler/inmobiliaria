"use client";

import dynamic from "next/dynamic";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BRAND } from "@/lib/brand";
import type { PropertyPerformance } from "./performanceData";
import { MIN_SAMPLE, rate } from "./performance";

const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((m) => m.PDFViewer), { ssr: false });

export type OwnerReportData = {
  title: string;
  location: string;
  priceLabel: string | null;
  operation: string | null;
  periodLabel: string;
  generatedOn: string;
  perf: PropertyPerformance;
};

// Helvetica (la fuente estándar del PDF) no tiene flechas ni signos
// matemáticos: el texto del informe usa solo caracteres latinos.
const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 10.5, color: "#111" },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 22 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 22, marginBottom: 8 },
  stages: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  stage: { width: "19%" },
  stageValue: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  stageLabel: { fontSize: 9, color: "#666" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e2e2e2" },
  note: { marginTop: 10, fontSize: 8.5, color: "#666" },
  obs: { marginBottom: 8 },
  obsTitle: { fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, fontSize: 8, color: "#888" },
});

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const dec = (n: number) => n.toFixed(1).replace(".", ",");
const pct = (v: number | null) => (v === null ? "sin datos suficientes" : `${dec(v)}%`);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;

function ReportDocument({ d }: { d: OwnerReportData }) {
  const { perf } = d;
  const { funnel, views, benchmarks } = perf;
  const { conversion, price } = benchmarks;
  const observations = (perf.diagnosis ?? []).filter((o) => !o.internal);

  const stages = [
    { label: "Vistas", value: views === null ? "-" : nf.format(views) },
    { label: "Consultas", value: nf.format(funnel.inquiries) },
    { label: "Calificados", value: nf.format(funnel.qualified) },
    { label: "Visitas", value: nf.format(funnel.visits) },
    { label: "En negociacion", value: nf.format(funnel.negotiation) },
  ];
  const viewToInquiry = views !== null && views >= 100 ? (funnel.inquiries / views) * 100 : null;
  const rows: [string, string][] = [
    ["De vista a consulta", pct(viewToInquiry)],
    ["De consulta a visita", pct(rate(funnel.visits, funnel.inquiries))],
    ["De visita a negociacion", pct(rate(funnel.negotiation, funnel.visits))],
  ];

  return (
    <Document title={`Informe de rendimiento - ${d.title}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{BRAND.name}</Text>
        <Text style={styles.muted}>Informe de rendimiento de la propiedad · {d.generatedOn}</Text>

        <Text style={styles.title}>{d.title}</Text>
        <Text style={styles.muted}>
          {[d.location, d.priceLabel, d.operation].filter(Boolean).join(" · ")}
        </Text>
        <Text style={styles.muted}>
          {d.periodLabel} · {perf.daysOnMarket} dias publicada
        </Text>

        <Text style={styles.h2}>Resumen</Text>
        <View style={styles.stages}>
          {stages.map((s) => (
            <View key={s.label} style={styles.stage}>
              <Text style={styles.stageValue}>{s.value}</Text>
              <Text style={styles.stageLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
        {rows.map(([label, value]) => (
          <View key={label} style={[styles.row, { marginTop: label === rows[0][0] ? 12 : 0 }]}>
            <Text>{label}</Text>
            <Text>{value}</Text>
          </View>
        ))}
        {perf.viewsNote && <Text style={styles.note}>{perf.viewsNote}</Text>}
        <Text style={styles.note}>
          Los porcentajes se muestran con al menos {MIN_SAMPLE} consultas (100 vistas para vista a consulta). Una persona
          que consulto mas de una vez cuenta una sola.
        </Text>

        {(price || conversion.cohortVisitRate !== null) && (
          <>
            <Text style={styles.h2}>Comparacion con propiedades similares de la cartera</Text>
            {conversion.own && conversion.cohortVisitRate !== null && (
              <View style={styles.row}>
                <Text>Consulta a visita, primeros 30 dias</Text>
                <Text>
                  {pct(conversion.own.visitRate)} (similares: {pct(conversion.cohortVisitRate)})
                </Text>
              </View>
            )}
            {price && (
              <View style={styles.row}>
                <Text>Precio por m2 ({price.basis === "covered" ? "cubierto" : "total"})</Text>
                <Text>USD {nf.format(price.usdPerM2)}</Text>
              </View>
            )}
            {price?.active && (
              <View style={styles.row}>
                <Text>Contra publicadas similares ({price.active.n})</Text>
                <Text>
                  {signed(price.active.diff)} (mediana USD {nf.format(price.active.median)})
                </Text>
              </View>
            )}
            {price?.closings && (
              <View style={styles.row}>
                <Text>Contra cierres reales ({price.closings.n}, ultimos 24 meses)</Text>
                <Text>
                  {signed(price.closings.diff)} (mediana USD {nf.format(price.closings.median)})
                </Text>
              </View>
            )}
            <Text style={styles.note}>
              Similares: misma operacion, tipo y ciudad, de nuestra propia cartera. No es un valor de mercado.
            </Text>
          </>
        )}

        {perf.priceChanges.length > 0 && (
          <>
            <Text style={styles.h2}>Cambios de precio</Text>
            {perf.priceChanges.map((c) => (
              <View key={c.at} style={styles.row} wrap={false}>
                <Text>
                  {new Date(c.at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}: {c.fromCurrency} {nf.format(c.from)} a {c.currency} {nf.format(c.to)}
                  {c.pct !== null ? ` (${signed(c.pct)})` : ""}
                </Text>
                <Text>
                  {c.effect
                    ? `${c.effect.inquiriesBefore} a ${c.effect.inquiriesAfter} consultas (${c.effect.days} dias antes y despues)`
                    : "efecto aun no medible"}
                </Text>
              </View>
            ))}
          </>
        )}

        {observations.length > 0 && (
          <>
            <Text style={styles.h2}>Observaciones</Text>
            {observations.map((o) => (
              <View key={o.title} style={styles.obs} wrap={false}>
                <Text style={styles.obsTitle}>{o.title}</Text>
                <Text style={styles.muted}>{o.detail}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer} fixed>
          Informe elaborado por {BRAND.name} con datos propios de consultas, visitas y cierres. No constituye una tasacion.
        </Text>
      </Page>
    </Document>
  );
}

export function OwnerReportViewer({ data }: { data: OwnerReportData }) {
  return (
    <PDFViewer style={{ width: "100%", height: "100vh" }}>
      <ReportDocument d={data} />
    </PDFViewer>
  );
}
