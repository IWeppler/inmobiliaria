import type { Database } from "./supabase";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadNoteRow = Database["public"]["Tables"]["lead_notes"]["Row"];

export type Note = Pick<
  LeadNoteRow,
  "id" | "created_at" | "content" | "user_id"
>;

export type LeadWithDetails = LeadRow & {
  properties: {
    id: string;
    title: string;
  } | null;

  agents: {
    full_name: string;
  } | null;

  lead_notes?: Note[];

  // Derivados en servidor a partir de status_history / lead_notes (E0.2).
  // Opcionales porque no todas las queries los calculan.
  status_since?: string; // último cambio de status (o created_at si no hay)
  last_activity_at?: string; // max(created_at, último status, última nota)
};
