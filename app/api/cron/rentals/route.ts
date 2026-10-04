import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncIndexValues } from "@/features/rentals/indexSync";
import { runScheduledNotices } from "@/features/rentals/notifications";
import { purgeStaleDrafts } from "@/features/rentals/contractDrafts";

export const dynamic = "force-dynamic";

// Diario (vercel.json): trae ICL e IPC de las fuentes oficiales, aplica los
// ajustes vencidos que ya tienen su índice publicado y recalcula los
// punitorios automáticos (después del ajuste, que cambia las cuotas).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const indexes = await syncIndexValues();
  const { data, error } = await supabaseAdmin.rpc("rental_apply_due_adjustments");
  if (error) return NextResponse.json({ indexes, error: error.message }, { status: 500 });
  const { data: lateFees, error: lateFeeError } = await supabaseAdmin.rpc("rental_accrue_late_fees");
  if (lateFeeError) return NextResponse.json({ indexes, applied: data, error: lateFeeError.message }, { status: 500 });
  // Al final: los avisos usan los montos ya ajustados y los punitorios al día.
  const notices = await runScheduledNotices();
  // PDFs de contratos cargados con IA que nunca se guardaron.
  const purgedDrafts = await purgeStaleDrafts();
  return NextResponse.json({ indexes, applied: data, lateFees, notices, purgedDrafts });
}
