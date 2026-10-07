import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notFoundResponse, pdfResponse, resolvePortalLink } from "@/features/rentals/portal";
import { receiptCode } from "@/features/rentals/codes";
import { RECEIPT_SELECT, ReceiptDocument, type ReceiptData } from "@/features/rentals/pdf/ReceiptDocument";

export const dynamic = "force-dynamic";

// Recibo en PDF desde el portal: solo de cobros de contratos donde el
// contacto del link es inquilino o co-inquilino.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; rid: string }> }) {
  const { token, rid } = await params;
  const access = await resolvePortalLink(token);
  if (!access || !/^[0-9a-f-]{36}$/i.test(rid)) return notFoundResponse();

  const { data } = await supabaseAdmin.from("rental_payment_entries").select(RECEIPT_SELECT).eq("id", rid).maybeSingle();
  const receipt = data as unknown as ReceiptData | null;
  if (!receipt?.rental_charges || !access.tenantContractIds.includes(receipt.rental_charges.contract_id)) return notFoundResponse();

  const buffer = await renderToBuffer(<ReceiptDocument receipt={receipt} />);
  return pdfResponse(buffer, `Recibo ${receiptCode(receipt.receipt_number)}.pdf`);
}
