import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BRAND } from "@/lib/brand";
import { formatDate, money } from "@/features/rentals/logic";
import { contractCode, receiptCode } from "@/features/rentals/codes";

// Recibo de cobranza en PDF. Sin directiva de cliente: lo usan el visor
// del panel y el portal (generado en el servidor).
export type ReceiptData = {
  id: string; receipt_number: number; paid_at: string; amount: number; method: string; account: string | null; notes: string | null;
  rental_charges: { contract_id: string; description: string; currency: string; rental_contracts: {
    number: number;
    properties: { title: string } | null;
    tenant: { full_name: string; document: string | null } | null;
  } | null } | null;
};

export const RECEIPT_SELECT = `id, receipt_number, paid_at, amount, method, account, notes,
  rental_charges!inner(contract_id, description, currency,
    rental_contracts(number, properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name, document)))`;

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 11, color: "#111" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 32, marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  muted: { color: "#666" },
  total: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 24, textAlign: "right" },
});

export function ReceiptDocument({ receipt }: { receipt: ReceiptData }) {
  const charge = receipt.rental_charges;
  const tenant = charge?.rental_contracts?.tenant;
  return <Document title={`Recibo ${receiptCode(receipt.receipt_number)}`}><Page size="A4" style={styles.page}>
    <Text style={styles.brand}>{BRAND.name}</Text>
    <Text style={styles.muted}>Recibo interno de cobranza · {receiptCode(receipt.receipt_number)}</Text>
    <Text style={styles.title}>Recibimos de {tenant?.full_name ?? "Inquilino"}</Text>
    {tenant?.document && <Text style={styles.muted}>Documento: {tenant.document}</Text>}
    <View style={styles.row}><Text>Fecha</Text><Text>{formatDate(receipt.paid_at)}</Text></View>
    {charge?.rental_contracts?.number ? <View style={styles.row}><Text>Contrato</Text><Text>{contractCode(charge.rental_contracts.number)}</Text></View> : null}
    <View style={styles.row}><Text>Propiedad</Text><Text>{charge?.rental_contracts?.properties?.title ?? "-"}</Text></View>
    <View style={styles.row}><Text>Concepto</Text><Text>{charge?.description ?? "-"}</Text></View>
    <View style={styles.row}><Text>Medio de pago</Text><Text>{receipt.method}</Text></View>
    <View style={styles.row}><Text>Cuenta de ingreso</Text><Text>{receipt.account ?? "-"}</Text></View>
    {receipt.notes && <View style={styles.row}><Text>Observaciones</Text><Text>{receipt.notes}</Text></View>}
    <Text style={styles.total}>{money(receipt.amount, charge?.currency ?? "ARS")}</Text>
    <Text style={[styles.muted, { position: "absolute", bottom: 32, left: 44, right: 44, fontSize: 8 }]}>Comprobante de cobranza emitido por {BRAND.name}. No válido como factura.</Text>
  </Page></Document>;
}
