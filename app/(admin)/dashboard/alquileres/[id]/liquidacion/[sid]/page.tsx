"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { createClientBrowser } from "@/lib/supabase-browser";
import { BRAND } from "@/lib/brand";
import { formatDate, formatPeriod, money, type SettlementExpense } from "@/features/rentals/logic";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-slate-800" />
      </div>
    ),
  }
);

type Settlement = {
  id: string;
  period: string;
  rent_amount: number;
  commission_amount: number;
  expenses: SettlementExpense[];
  expenses_amount: number;
  net_amount: number;
  currency: string;
  issued_at: string;
  notes: string | null;
  rental_contracts: {
    commission_pct: number;
    properties: { title: string; street_address: string | null; city: string | null } | null;
    owner: { full_name: string; document: string | null } | null;
    tenant: { full_name: string } | null;
  } | null;
};

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  section: { marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 6, borderTopWidth: 2, borderTopColor: "#111" },
  bold: { fontFamily: "Helvetica-Bold" },
  grid: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
  label: { color: "#666", fontSize: 8, textTransform: "uppercase", marginBottom: 2 },
});

// E4.4 — Comprobante de liquidación al propietario.
function SettlementPdf({ d }: { d: Settlement }) {
  const c = d.rental_contracts;
  return (
    <Document title={`Liquidación ${formatPeriod(d.period)}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>{BRAND.name}</Text>
            <Text style={s.muted}>{BRAND.tagline}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>Liquidación de alquiler</Text>
            <Text style={s.muted}>Período: {formatPeriod(d.period)}</Text>
            <Text style={s.muted}>Emitida: {formatDate(d.issued_at)}</Text>
            <Text style={s.muted}>N° {d.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        <View style={[s.section, s.grid]}>
          <View style={s.col}>
            <Text style={s.label}>Propietario</Text>
            <Text style={s.bold}>{c?.owner?.full_name ?? "—"}</Text>
            {c?.owner?.document ? <Text style={s.muted}>{c.owner.document}</Text> : null}
          </View>
          <View style={s.col}>
            <Text style={s.label}>Inmueble</Text>
            <Text style={s.bold}>{c?.properties?.title ?? "—"}</Text>
            <Text style={s.muted}>
              {[c?.properties?.street_address, c?.properties?.city].filter(Boolean).join(", ")}
            </Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>Inquilino</Text>
            <Text style={s.bold}>{c?.tenant?.full_name ?? "—"}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text>Alquiler cobrado</Text>
            <Text>{money(d.rent_amount, d.currency)}</Text>
          </View>
          <View style={s.row}>
            <Text>Honorarios de administración ({c?.commission_pct ?? 0} %)</Text>
            <Text>− {money(d.commission_amount, d.currency)}</Text>
          </View>
          {d.expenses.map((e, i) => (
            <View key={i} style={s.row}>
              <Text>{e.description}</Text>
              <Text>− {money(e.amount, d.currency)}</Text>
            </View>
          ))}
          <View style={s.total}>
            <Text style={[s.bold, { fontSize: 12 }]}>Neto a transferir al propietario</Text>
            <Text style={[s.bold, { fontSize: 12 }]}>{money(d.net_amount, d.currency)}</Text>
          </View>
        </View>

        {d.notes ? (
          <View style={s.section}>
            <Text style={s.label}>Observaciones</Text>
            <Text>{d.notes}</Text>
          </View>
        ) : null}

        <Text style={[s.muted, { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8 }]}>
          Comprobante emitido por {BRAND.name}. No válido como factura.
        </Text>
      </Page>
    </Document>
  );
}

export default function LiquidacionPdfPage() {
  const { sid } = useParams<{ sid: string }>();
  const [data, setData] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClientBrowser();
    supabase
      .from("rental_settlements")
      .select(
        `id, period, rent_amount, commission_amount, expenses, expenses_amount, net_amount, currency, issued_at, notes,
         rental_contracts(commission_pct, properties(title, street_address, city),
           owner:rental_contacts!rental_contracts_owner_id_fkey(full_name, document),
           tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name))`
      )
      .eq("id", sid)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError(error?.message ?? "No encontrada");
        else setData(data as unknown as Settlement);
      });
  }, [sid]);

  if (error) return <p className="p-8">Error: {error}</p>;
  if (!data)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-slate-800" />
      </div>
    );

  return (
    <PDFViewer style={{ width: "100%", height: "100vh" }}>
      <SettlementPdf d={data} />
    </PDFViewer>
  );
}
