import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PDFs de contrato subidos antes de que exista el contrato (carga con IA).
// Viven en rental-docs/drafts/<user_id>/ (policy: solo su autor) hasta que
// se crea el contrato y pasan a rental-docs/<contract_id>/.

const BUCKET = "rental-docs";
const STALE_MS = 2 * 24 * 60 * 60 * 1000;

export const draftPrefix = (userId: string) => `drafts/${userId}/`;

export function isOwnDraft(path: string, userId: string) {
  return path.startsWith(draftPrefix(userId)) && !path.includes("..") && path.split("/").length === 3;
}

// Mueve el borrador a la carpeta del contrato y lo registra como contrato
// firmado. El move va con service role (la policy de storage no permite
// mover entre carpetas), pero solo después de validar que el borrador es
// del usuario y que el contrato lo puede ver con su sesión.
export async function attachDraftPdf(
  supabase: SupabaseClient<Database>,
  userId: string,
  contractId: string,
  draftPath: string,
  fileName: string,
): Promise<boolean> {
  if (!isOwnDraft(draftPath, userId)) return false;
  const { data: contract } = await supabase.from("rental_contracts").select("id").eq("id", contractId).maybeSingle();
  if (!contract) return false;

  const path = `${contractId}/${crypto.randomUUID()}.pdf`;
  const { error: moveError } = await supabaseAdmin.storage.from(BUCKET).move(draftPath, path);
  if (moveError) return false;
  const { error } = await supabase.from("rental_documents").insert({
    contract_id: contractId, kind: "CONTRATO", path, file_name: fileName.slice(0, 200) || "Contrato.pdf",
  });
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return false;
  }
  return true;
}

// Cron: borra los borradores que nunca terminaron en un contrato.
export async function purgeStaleDrafts(): Promise<number> {
  const bucket = supabaseAdmin.storage.from(BUCKET);
  const { data: folders } = await bucket.list("drafts", { limit: 1000 });
  const cutoff = Date.now() - STALE_MS;
  const stale: string[] = [];
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`drafts/${folder.name}`, { limit: 1000 });
    for (const file of files ?? []) {
      if (file.created_at && new Date(file.created_at).getTime() < cutoff) stale.push(`drafts/${folder.name}/${file.name}`);
    }
  }
  if (stale.length) await bucket.remove(stale);
  return stale.length;
}
