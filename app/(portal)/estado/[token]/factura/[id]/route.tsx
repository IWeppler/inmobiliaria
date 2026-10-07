import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CBTE_LABELS, formatInvoiceNumber } from "@/features/rentals/invoicing";
import { invoicePdfProps } from "@/features/rentals/invoicePdfData";
import { notFoundResponse, pdfResponse, resolvePortalLink } from "@/features/rentals/portal";
import { InvoiceDocument } from "@/features/rentals/pdf/InvoiceDocument";

export const dynamic = "force-dynamic";

// Factura de honorarios en PDF desde el portal: solo las emitidas a nombre
// del contacto del link.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const access = await resolvePortalLink(token);
  if (!access || !/^[0-9a-f-]{36}$/i.test(id)) return notFoundResponse();

  const { data: invoice } = await supabaseAdmin.from("rental_invoices").select("*").eq("id", id).eq("contact_id", access.contactId).maybeSingle();
  if (!invoice) return notFoundResponse();

  const buffer = await renderToBuffer(<InvoiceDocument {...await invoicePdfProps(supabaseAdmin, invoice)} />);
  return pdfResponse(buffer, `${CBTE_LABELS[invoice.cbte_tipo]} ${formatInvoiceNumber(invoice.pto_vta, invoice.cbte_nro)}.pdf`);
}
