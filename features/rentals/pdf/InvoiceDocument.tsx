import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate, money } from "@/features/rentals/logic";
import { CBTE_LABELS, IVA_LABELS, cbteLetter, formatInvoiceNumber, type IvaCondition } from "@/features/rentals/invoicing";

// Factura / nota de crédito ARCA en PDF. Sin directiva de cliente: la usan
// el visor del panel y el portal (generada en el servidor).
export type InvoiceData = {
  kind: string; cbte_tipo: number; pto_vta: number; cbte_nro: number; environment: string; issued_on: string;
  receptor_name: string; receptor_doc_tipo: number; receptor_doc_nro: string; receptor_iva: string;
  description: string; currency: string; exchange_rate: number; net: number; vat: number; total: number;
  service_from: string | null; service_to: string | null; cae: string; cae_due: string; associated: string | null;
};
export type EmitterData = { name: string; cuit: string; iva: string; address: string | null; iibb: string | null; startDate: string | null };

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#111" },
  box: { borderWidth: 1, borderColor: "#111" },
  header: { flexDirection: "row" },
  half: { flex: 1, padding: 10 },
  letter: { position: "absolute", left: "50%", top: 0, marginLeft: -22, width: 44, height: 44, borderWidth: 1, borderColor: "#111", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  letterText: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  big: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  section: { marginTop: 8, padding: 10 },
  muted: { color: "#555" },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 4, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  test: { color: "#b45309", fontFamily: "Helvetica-Bold", marginBottom: 6 },
});

const DOC_LABELS: Record<number, string> = { 80: "CUIT", 96: "DNI", 99: "Sin identificar" };

export function InvoiceDocument({ invoice, emitter, qr }: { invoice: InvoiceData; emitter: EmitterData; qr: string }) {
  const letter = cbteLetter(invoice.cbte_tipo);
  const label = CBTE_LABELS[invoice.cbte_tipo] ?? "Comprobante";
  const number = formatInvoiceNumber(invoice.pto_vta, invoice.cbte_nro);
  const discriminated = letter === "A";
  return (
    <Document title={`${label} ${number}`}>
      <Page size="A4" style={s.page}>
        {invoice.environment === "HOMOLOGACION" && <Text style={s.test}>COMPROBANTE DE PRUEBA (homologación de ARCA): sin validez fiscal.</Text>}
        <View style={[s.box, s.header]}>
          <View style={s.half}>
            <Text style={s.big}>{emitter.name}</Text>
            {emitter.address && <Text>{emitter.address}</Text>}
            <Text>{IVA_LABELS[emitter.iva as IvaCondition] ?? emitter.iva}</Text>
          </View>
          <View style={[s.half, { borderLeftWidth: 1, borderColor: "#111", paddingLeft: 40 }]}>
            <Text style={s.big}>{label.replace(` ${letter}`, "").toUpperCase()}</Text>
            <Text style={s.bold}>N° {number}</Text>
            <Text>Fecha de emisión: {formatDate(invoice.issued_on)}</Text>
            <Text>CUIT: {emitter.cuit}</Text>
            {emitter.iibb && <Text>Ingresos Brutos: {emitter.iibb}</Text>}
            {emitter.startDate && <Text>Inicio de actividades: {emitter.startDate}</Text>}
          </View>
          <View style={s.letter}>
            <Text style={s.letterText}>{letter}</Text>
            <Text style={{ fontSize: 6 }}>COD. {String(invoice.cbte_tipo).padStart(3, "0")}</Text>
          </View>
        </View>

        <View style={[s.box, s.section]}>
          <View style={s.row}>
            <Text><Text style={s.bold}>Cliente: </Text>{invoice.receptor_name}</Text>
            <Text>{DOC_LABELS[invoice.receptor_doc_tipo] ?? "Doc."}: {invoice.receptor_doc_nro === "0" ? "-" : invoice.receptor_doc_nro}</Text>
          </View>
          <Text>Condición frente al IVA: {IVA_LABELS[invoice.receptor_iva as IvaCondition] ?? invoice.receptor_iva}</Text>
          {invoice.service_from && invoice.service_to && (
            <Text>Período facturado: {formatDate(invoice.service_from)} al {formatDate(invoice.service_to)} · Vencimiento del pago: {formatDate(invoice.issued_on)}</Text>
          )}
          {invoice.associated && <Text>Comprobante asociado: {invoice.associated}</Text>}
        </View>

        <View style={[s.box, s.section, { minHeight: 260 }]}>
          <View style={s.tableHead}>
            <Text style={{ flex: 1 }}>Descripción</Text>
            <Text style={{ width: 110, textAlign: "right" }}>Importe</Text>
          </View>
          <View style={s.row}>
            <Text style={{ flex: 1 }}>{invoice.description}</Text>
            <Text style={{ width: 110, textAlign: "right" }}>{money(discriminated ? invoice.net : invoice.total, invoice.currency)}</Text>
          </View>
        </View>

        <View style={[s.box, s.section]}>
          {discriminated && <View style={s.row}><Text>Importe neto gravado</Text><Text>{money(invoice.net, invoice.currency)}</Text></View>}
          {discriminated && <View style={s.row}><Text>IVA 21 %</Text><Text>{money(invoice.vat, invoice.currency)}</Text></View>}
          <View style={s.row}><Text style={s.bold}>Importe total</Text><Text style={s.bold}>{money(invoice.total, invoice.currency)}</Text></View>
          {letter === "B" && invoice.vat > 0 && (
            <Text style={s.muted}>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743): IVA contenido {money(invoice.vat, invoice.currency)}</Text>
          )}
          {invoice.currency === "USD" && <Text style={s.muted}>Tipo de cambio: {invoice.exchange_rate.toLocaleString("es-AR")}</Text>}
        </View>

        <View style={s.footer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no lleva alt */}
          <Image src={qr} style={{ width: 90, height: 90 }} />
          <View>
            <Text style={s.bold}>Comprobante autorizado por ARCA</Text>
            <Text>CAE N°: {invoice.cae}</Text>
            <Text>Vencimiento del CAE: {formatDate(invoice.cae_due)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
