import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BRAND } from "@/lib/brand";
import { formatDate, formatPeriod, money, type SettlementExpense } from "@/features/rentals/logic";
import { contractCode, settlementCode } from "@/features/rentals/codes";

// E4.4 — Comprobante de liquidación al propietario. Sin directiva de
// cliente: lo usan el visor del panel y el portal (generado en el servidor).
export type SettlementData = {
  id: string;
  number: number;
  period: string;
  rent_amount: number;
  other_collected_amount: number;
  commission_amount: number;
  expenses: SettlementExpense[];
  expenses_amount: number;
  net_amount: number;
  currency: string;
  issued_at: string;
  notes: string | null;
  shares: { share_pct: number; amount: number; is_primary: boolean; contact: { full_name: string; document: string | null } | null }[];
  rental_contracts: {
    number: number;
    commission_pct: number;
    properties: { title: string; street_address: string | null; city: string | null } | null;
    owner: { full_name: string; document: string | null } | null;
    tenant: { full_name: string } | null;
  } | null;
};

export const SETTLEMENT_SELECT = `id, number, period, rent_amount, other_collected_amount, commission_amount, expenses, expenses_amount, net_amount, currency, issued_at, notes,
  shares:rental_settlement_shares(share_pct, amount, is_primary, contact:rental_contacts(full_name, document)),
  rental_contracts(number, commission_pct, properties(title, street_address, city),
    owner:rental_contacts!rental_contracts_owner_id_fkey(full_name, document),
    tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name))`;

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

export function SettlementDocument({ d }: { d: SettlementData }) {
  const c = d.rental_contracts;
  // Titulares según el reparto congelado al emitir (principal primero).
  const shares = [...d.shares].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || b.share_pct - a.share_pct);
  const multiple = shares.length > 1;
  return (
    <Document title={`Liquidación ${settlementCode(d.number)} · ${formatPeriod(d.period)}`}>
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
            <Text style={s.muted}>{settlementCode(d.number)}{c?.number ? ` · contrato ${contractCode(c.number)}` : ""}</Text>
          </View>
        </View>

        <View style={[s.section, s.grid]}>
          <View style={s.col}>
            <Text style={s.label}>{multiple ? "Propietarios" : "Propietario"}</Text>
            {multiple ? shares.map((sh, i) => (
              <Text key={i} style={s.bold}>{sh.contact?.full_name ?? "-"} ({sh.share_pct} %)</Text>
            )) : <>
              <Text style={s.bold}>{shares[0]?.contact?.full_name ?? c?.owner?.full_name ?? "-"}</Text>
              {(shares[0]?.contact?.document ?? c?.owner?.document) ? <Text style={s.muted}>{shares[0]?.contact?.document ?? c?.owner?.document}</Text> : null}
            </>}
          </View>
          <View style={s.col}>
            <Text style={s.label}>Inmueble</Text>
            <Text style={s.bold}>{c?.properties?.title ?? "-"}</Text>
            <Text style={s.muted}>{[c?.properties?.street_address, c?.properties?.city].filter(Boolean).join(", ")}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>Inquilino</Text>
            <Text style={s.bold}>{c?.tenant?.full_name ?? "-"}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}><Text>Alquiler cobrado</Text><Text>{money(d.rent_amount, d.currency)}</Text></View>
          {d.other_collected_amount > 0 && <View style={s.row}><Text>Otros cargos cobrados</Text><Text>{money(d.other_collected_amount, d.currency)}</Text></View>}
          <View style={s.row}>
            <Text>Honorarios de administración ({c?.commission_pct ?? 0} %)</Text>
            <Text>- {money(d.commission_amount, d.currency)}</Text>
          </View>
          {d.expenses.map((e, i) => (
            <View key={i} style={s.row}><Text>{e.description}</Text><Text>- {money(e.amount, d.currency)}</Text></View>
          ))}
          <View style={s.total}>
            <Text style={[s.bold, { fontSize: 12 }]}>{multiple ? "Neto a distribuir" : "Neto a transferir al propietario"}</Text>
            <Text style={[s.bold, { fontSize: 12 }]}>{money(d.net_amount, d.currency)}</Text>
          </View>
        </View>

        {multiple ? (
          <View style={s.section}>
            <Text style={s.label}>Distribución entre propietarios</Text>
            {shares.map((sh, i) => (
              <View key={i} style={s.row}>
                <Text>{sh.contact?.full_name ?? "-"}{sh.contact?.document ? ` (${sh.contact.document})` : ""} · {sh.share_pct} %</Text>
                <Text style={s.bold}>{money(sh.amount, d.currency)}</Text>
              </View>
            ))}
          </View>
        ) : null}

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
