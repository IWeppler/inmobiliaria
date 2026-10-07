import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { daysBetween, formatDate } from "@/features/rentals/logic";
import { phoneDigits } from "@/features/rentals/tasks";
import { checklistProgress, type DealChecklist, type DealStage } from "@/features/dashboard/deals/deal";
import { listingAlerts } from "@/features/dashboard/listings/listing";
import type { TodayTask } from "@/features/dashboard/today/types";

// Tareas de la bandeja Hoy para operaciones (postventa) y captaciones.
// Personales, como el resto de ventas; se generan desde los datos.

const LOAN_FOLLOW_UP_DAYS = 20;
const firstName = (name: string) => name.split(" ")[0] ?? name;
const dayLabel = (days: number) => (days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`);

type Deal = {
  id: string; name: string; phone: string | null; deal_stage: string; deal_financing: boolean; deal_loan_status: string | null;
  reserva_expires_at: string | null; boleto_at: string | null; escritura_at: string | null; deal_checklist: unknown; deal_updated_at: string | null;
  property: { title: string; status: string | null } | null;
};

export async function buildDealTasks(supabase: SupabaseClient<Database>, userId: string, today = ymdInAppTz()): Promise<TodayTask[]> {
  const { data } = await supabase.from("leads")
    .select("id, name, phone, deal_stage, deal_financing, deal_loan_status, reserva_expires_at, boleto_at, escritura_at, deal_checklist, deal_updated_at, property:properties(title, status)")
    .eq("agent_id", userId).in("deal_stage", ["RESERVA", "BOLETO", "FINANCIACION", "ESCRITURA", "ESCRITURADA"]);
  const tasks: TodayTask[] = [];

  for (const d of (data ?? []) as unknown as Deal[]) {
    const stage = d.deal_stage as DealStage;
    const link = { href: `/dashboard/leads/${d.id}`, label: "ver operación" };
    const open = [{ type: "link" as const, label: "Abrir operación", href: link.href }];
    const property = d.property?.title;
    const progress = checklistProgress(stage, (d.deal_checklist as DealChecklist) ?? {});
    const pending = progress.pending.length ? `faltan ${progress.pending.length} pasos` : "checklist completo";
    const base = { area: "ventas" as const, category: "operaciones" as const, link };

    if (stage === "RESERVA" && d.reserva_expires_at) {
      const days = daysBetween(today, d.reserva_expires_at);
      if (days <= 3) tasks.push({
        ...base, key: `OP-RESERVA:${d.id}:${d.reserva_expires_at}`, urgency: days <= 1 ? "alta" : "media", score: 110 - days,
        title: days < 0 ? `Reserva vencida: ${d.name}` : `Vence la reserva de ${d.name} ${dayLabel(days)}`,
        detail: [property, days < 0 ? "Pasala a boleto, extendé el vencimiento o marcala caída" : "Avanzá a boleto o extendé el plazo"].filter(Boolean).join(" · "),
        actions: open,
      });
    }

    if (stage === "BOLETO" && d.boleto_at) {
      const days = daysBetween(today, d.boleto_at);
      if (days < 0) tasks.push({
        ...base, key: `OP-BOLETO:${d.id}:${d.boleto_at}`, urgency: "alta", score: 105,
        title: `¿Se firmó el boleto de ${d.name}?`,
        detail: [property, `Estaba previsto para el ${formatDate(d.boleto_at)}`].filter(Boolean).join(" · "), actions: open,
      });
      else if (days <= 3 && progress.pending.length) tasks.push({
        ...base, key: `OP-BOLETO-PREP:${d.id}:${d.boleto_at}`, urgency: days <= 1 ? "alta" : "media", score: 100 - days,
        title: `Boleto de ${d.name} ${dayLabel(days)}`, detail: [property, pending].filter(Boolean).join(" · "), actions: open,
      });
    }

    if (stage === "FINANCIACION") {
      if (d.deal_loan_status === "RECHAZADO") tasks.push({
        ...base, key: `OP-CREDITO-RECHAZADO:${d.id}`, urgency: "alta", score: 108,
        title: `Crédito rechazado: ${d.name}`, detail: [property, "Definí si sigue con otro banco o se cae la operación"].filter(Boolean).join(" · "),
        actions: open,
      });
      else {
        const idle = d.deal_updated_at ? daysBetween(ymdInAppTz(new Date(d.deal_updated_at)), today) : 0;
        if (idle >= LOAN_FOLLOW_UP_DAYS) {
          const phone = phoneDigits(d.phone);
          tasks.push({
            ...base, key: `OP-CREDITO:${d.id}:${today.slice(0, 7)}`, urgency: "media", score: 75 + Math.min(idle, 30),
            title: `Seguí el crédito de ${d.name}`, detail: [property, `Sin novedades hace ${idle} días`].filter(Boolean).join(" · "),
            actions: [
              ...(phone ? [{ type: "whatsapp" as const, label: "Preguntar", phone, snoozeDays: 5, text: `Hola ${firstName(d.name)}, ¿cómo viene el crédito? ¿Hubo novedades del banco?` }] : []),
              ...open,
            ],
          });
        }
      }
    }

    if ((stage === "ESCRITURA" || stage === "FINANCIACION") && d.escritura_at) {
      const days = daysBetween(today, d.escritura_at);
      if (stage === "ESCRITURA" && days < 0) tasks.push({
        ...base, key: `OP-ESCRITURA:${d.id}:${d.escritura_at}`, urgency: "alta", score: 106,
        title: `¿Se firmó la escritura de ${d.name}?`,
        detail: [property, `Estaba prevista para el ${formatDate(d.escritura_at)}`].filter(Boolean).join(" · "), actions: open,
      });
      else if (days >= 0 && days <= 7 && (stage === "FINANCIACION" || progress.pending.length)) tasks.push({
        ...base, key: `OP-ESCRITURA-PREP:${d.id}:${d.escritura_at}`, urgency: days <= 2 ? "alta" : "media", score: 98 - days,
        title: `Escritura de ${d.name} ${dayLabel(days)}`,
        detail: [property, stage === "FINANCIACION" ? "El crédito todavía no está aprobado" : pending].filter(Boolean).join(" · "), actions: open,
      });
    }

    if (stage === "ESCRITURADA" && d.property && d.property.status !== "VENDIDO") {
      const since = d.deal_updated_at ? daysBetween(ymdInAppTz(new Date(d.deal_updated_at)), today) : 0;
      if (since <= 60) tasks.push({
        ...base, key: `OP-VENTA:${d.id}`, urgency: since > 3 ? "alta" : "media", score: 90,
        title: `Registrá la venta de ${d.property.title}`, detail: `Escriturada con ${d.name}: falta cargar la comisión en Finanzas`,
        actions: [{ type: "link", label: "Registrar venta", href: link.href }],
      });
    }
  }
  return tasks;
}

type Listing = {
  id: string; owner_name: string; owner_phone: string | null; stage: string; stage_changed_at: string;
  address: string | null; next_action: string | null; next_action_at: string | null;
  authorization_expires_at: string | null; appraisal_value: number | null; owner_price: number | null;
};

export async function buildListingTasks(supabase: SupabaseClient<Database>, userId: string, today = ymdInAppTz()): Promise<TodayTask[]> {
  const { data } = await supabase.from("owner_prospects")
    .select("id, owner_name, owner_phone, stage, stage_changed_at, address, next_action, next_action_at, authorization_expires_at, appraisal_value, owner_price")
    .eq("agent_id", userId).in("stage", ["CONTACTO", "TASACION", "PROPUESTA", "AUTORIZACION", "PUBLICADA"]);
  const tasks: TodayTask[] = [];

  for (const p of (data ?? []) as Listing[]) {
    // Una tarea por captación: la alerta más importante (sin la de precio).
    const alert = listingAlerts(p, today).find((a) => a.kind !== "precio");
    if (!alert) continue;
    // Publicada: solo interesa la autorización por vencer.
    if (p.stage === "PUBLICADA" && alert.kind !== "autorizacion") continue;
    const href = `/dashboard/captaciones?c=${p.id}`;
    const phone = phoneDigits(p.owner_phone);
    const title = alert.kind === "paso" ? `${p.next_action}: ${p.owner_name}`
      : alert.kind === "autorizacion" ? `Renovar la autorización de ${p.owner_name}`
      : `Retomar la captación de ${p.owner_name}`;
    const marker = alert.kind === "paso" ? p.next_action_at : alert.kind === "autorizacion" ? p.authorization_expires_at : p.stage;
    tasks.push({
      key: `CAPTACION:${p.id}:${alert.kind}:${marker}`, area: "ventas", category: "captaciones",
      urgency: alert.urgency, score: (alert.kind === "paso" ? 92 : alert.kind === "autorizacion" ? 80 : 50) + Math.min(Math.abs(alert.days), 20),
      title, detail: [alert.kind === "paso" ? alert.text.replace(`${p.next_action} `, "").replace(/[()]/g, "") : alert.text, p.address].filter(Boolean).join(" · "),
      link: { href, label: "ver captación" },
      actions: [
        ...(phone ? [{ type: "whatsapp" as const, label: "WhatsApp", phone, snoozeDays: 2, text: `Hola ${firstName(p.owner_name)}, ¿cómo estás? ` }] : []),
        { type: "link", label: "Abrir", href },
      ],
    });
  }
  return tasks;
}
