"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { SETTLEMENT_SELECT, SettlementDocument, type SettlementData } from "@/features/rentals/pdf/SettlementDocument";

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

export default function LiquidacionPdfPage() {
  const { sid } = useParams<{ sid: string }>();
  const [data, setData] = useState<SettlementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClientBrowser()
      .from("rental_settlements")
      .select(SETTLEMENT_SELECT)
      .eq("id", sid)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError(error?.message ?? "No encontrada");
        else setData(data as unknown as SettlementData);
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
      <SettlementDocument d={data} />
    </PDFViewer>
  );
}
