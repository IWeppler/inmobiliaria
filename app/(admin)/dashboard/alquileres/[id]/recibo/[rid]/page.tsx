"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { createClientBrowser } from "@/lib/supabase-browser";
import { BRAND } from "@/lib/brand";
import { formatDate, money } from "@/features/rentals/logic";

const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((module) => module.PDFViewer), { ssr: false });

type Receipt = {
  id: string; receipt_number: number; paid_at: string; amount: number; method: string; account: string | null; notes: string | null;
  rental_charges: { contract_id: string; description: string; currency: string; rental_contracts: {
    properties: { title: string } | null;
    tenant: { full_name: string; document: string | null } | null;
  } | null } | null;
};

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 11, color: "#111" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 32, marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  muted: { color: "#666" },
  total: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 24, textAlign: "right" },
});

function ReceiptDocument({ receipt }: { receipt: Receipt }) {
  const charge = receipt.rental_charges;
  const tenant = charge?.rental_contracts?.tenant;
  return <Document title={`Recibo N.º ${receipt.receipt_number}`}><Page size="A4" style={styles.page}>
    <Text style={styles.brand}>{BRAND.name}</Text>
    <Text style={styles.muted}>Recibo interno de cobranza · N.º {receipt.receipt_number}</Text>
    <Text style={styles.title}>Recibimos de {tenant?.full_name ?? "Inquilino"}</Text>
    {tenant?.document && <Text style={styles.muted}>Documento: {tenant.document}</Text>}
    <View style={styles.row}><Text>Fecha</Text><Text>{formatDate(receipt.paid_at)}</Text></View>
    <View style={styles.row}><Text>Propiedad</Text><Text>{charge?.rental_contracts?.properties?.title ?? "—"}</Text></View>
    <View style={styles.row}><Text>Concepto</Text><Text>{charge?.description ?? "—"}</Text></View>
    <View style={styles.row}><Text>Medio de pago</Text><Text>{receipt.method}</Text></View>
    <View style={styles.row}><Text>Cuenta de ingreso</Text><Text>{receipt.account ?? "—"}</Text></View>
    {receipt.notes && <View style={styles.row}><Text>Observaciones</Text><Text>{receipt.notes}</Text></View>}
    <Text style={styles.total}>{money(receipt.amount, charge?.currency ?? "ARS")}</Text>
    <Text style={[styles.muted, { position: "absolute", bottom: 32, left: 44, right: 44, fontSize: 8 }]}>Comprobante de cobranza emitido por {BRAND.name}. No válido como factura.</Text>
  </Page></Document>;
}

export default function ReciboPage() {
  const { id, rid } = useParams<{ id: string; rid: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    createClientBrowser().from("rental_payment_entries")
      .select(`id, receipt_number, paid_at, amount, method, account, notes,
        rental_charges!inner(contract_id, description, currency,
          rental_contracts(properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name, document)))`)
      .eq("id", rid).eq("rental_charges.contract_id", id).single()
      .then(({ data, error: queryError }) => {
        if (queryError || !data) setError(queryError?.message ?? "Recibo no encontrado.");
        else setReceipt(data as unknown as Receipt);
      });
  }, [id, rid]);
  if (error) return <p className="p-8">{error}</p>;
  if (!receipt) return <p className="p-8">Cargando recibo…</p>;
  return <PDFViewer style={{ width: "100%", height: "100vh" }}><ReceiptDocument receipt={receipt} /></PDFViewer>;
}
