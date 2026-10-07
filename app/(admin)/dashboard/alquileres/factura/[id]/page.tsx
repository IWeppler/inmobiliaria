import { notFound, redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { invoicePdfProps } from "@/features/rentals/invoicePdfData";
import { InvoiceViewer } from "@/features/rentals/InvoicePdf";

// Factura / nota de crédito ARCA en PDF, con el QR obligatorio. Los datos
// del emisor salen de las variables AFIP_*; la factura, de la base (RLS).
export default async function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invoice } = await supabase.from("rental_invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) notFound();
  return <InvoiceViewer {...await invoicePdfProps(supabase, invoice)} />;
}
