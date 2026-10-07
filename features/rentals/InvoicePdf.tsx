"use client";

import dynamic from "next/dynamic";
import { InvoiceDocument, type EmitterData, type InvoiceData } from "@/features/rentals/pdf/InvoiceDocument";

const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((m) => m.PDFViewer), { ssr: false });

// Visor del panel para la factura ARCA.
export function InvoiceViewer(props: { invoice: InvoiceData; emitter: EmitterData; qr: string }) {
  return (
    <PDFViewer style={{ width: "100%", height: "100vh" }}>
      <InvoiceDocument {...props} />
    </PDFViewer>
  );
}
