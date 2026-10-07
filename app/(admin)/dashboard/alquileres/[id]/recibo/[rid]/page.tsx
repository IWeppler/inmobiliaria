"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClientBrowser } from "@/lib/supabase-browser";
import { RECEIPT_SELECT, ReceiptDocument, type ReceiptData } from "@/features/rentals/pdf/ReceiptDocument";

const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((module) => module.PDFViewer), { ssr: false });

export default function ReciboPage() {
  const { id, rid } = useParams<{ id: string; rid: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    createClientBrowser().from("rental_payment_entries")
      .select(RECEIPT_SELECT)
      .eq("id", rid).eq("rental_charges.contract_id", id).single()
      .then(({ data, error: queryError }) => {
        if (queryError || !data) setError(queryError?.message ?? "Recibo no encontrado.");
        else setReceipt(data as unknown as ReceiptData);
      });
  }, [id, rid]);
  if (error) return <p className="p-8">{error}</p>;
  if (!receipt) return <p className="p-8">Cargando recibo…</p>;
  return <PDFViewer style={{ width: "100%", height: "100vh" }}><ReceiptDocument receipt={receipt} /></PDFViewer>;
}
