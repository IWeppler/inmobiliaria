import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatPeriod } from "@/features/rentals/logic";
import { notFoundResponse, pdfResponse, resolvePortalLink } from "@/features/rentals/portal";
import { SETTLEMENT_SELECT, SettlementDocument, type SettlementData } from "@/features/rentals/pdf/SettlementDocument";

export const dynamic = "force-dynamic";

// Liquidación en PDF desde el portal: solo si el contacto del link es
// titular de una parte de esa liquidación.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; sid: string }> }) {
  const { token, sid } = await params;
  const access = await resolvePortalLink(token);
  if (!access || !/^[0-9a-f-]{36}$/i.test(sid)) return notFoundResponse();

  const { count } = await supabaseAdmin.from("rental_settlement_shares")
    .select("id", { count: "exact", head: true }).eq("settlement_id", sid).eq("contact_id", access.contactId);
  if (!count) return notFoundResponse();

  const { data } = await supabaseAdmin.from("rental_settlements").select(SETTLEMENT_SELECT).eq("id", sid).maybeSingle();
  const settlement = data as unknown as SettlementData | null;
  if (!settlement) return notFoundResponse();

  const buffer = await renderToBuffer(<SettlementDocument d={settlement} />);
  return pdfResponse(buffer, `Liquidacion ${formatPeriod(settlement.period)}.pdf`);
}
