import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { BRAND } from "@/lib/brand";
import { addDays, APP_TZ, dayStartISO, ymdInAppTz } from "@/lib/dates";
import { daysBetween, formatDate } from "@/features/rentals/logic";
import { phoneDigits } from "@/features/rentals/tasks";
import { businessMinutes } from "@/features/dashboard/reports/responseTime";
import { getLeadTemperature, normalizeStatus } from "@/features/dashboard/leads/leadStatus";
import { findBuyerMatches } from "@/features/dashboard/buyers/queries";
import type { TodayTask } from "@/features/dashboard/today/types";

// Tareas de ventas para la bandeja Hoy. Son personales: los leads,
// visitas y propiedades del usuario (también para admin, que ve el equipo
// en Reportes). Se generan desde los datos; no se guardan.

type Lead = {
  id: string; name: string; phone: string | null; status: string | null; created_at: string;
  next_action: string | null; next_action_at: string | null; deal_stage: string | null;
  property: { title: string } | null;
  notes: { created_at: string }[];
};

const STRONG_MATCH = 70;
const MAX_NO_NEXT_STEP = 20;
const firstName = (name: string) => name.split(" ")[0] ?? name;
const leadLink = (id: string) => ({ href: `/dashboard/leads/${id}`, label: "ver lead" });

export async function buildSalesTasks(supabase: SupabaseClient<Database>, userId: string, today = ymdInAppTz()): Promise<TodayTask[]> {
  const now = new Date();
  const [{ data: leadsRaw }, { data: visits }, { data: properties }] = await Promise.all([
    supabase.from("leads")
      .select("id, name, phone, status, created_at, next_action, next_action_at, deal_stage, property:properties(title), notes:lead_notes(created_at)")
      .eq("agent_id", userId)
      .not("status", "in", '("CERRADO","DESCARTADO")'),
    supabase.from("events")
      .select("id, date, time, lead_id, lead:leads(name, status), property:properties(title)")
      .eq("agent_id", userId).eq("type", "visita").is("outcome", null).not("lead_id", "is", null)
      .gte("date", dayStartISO(addDays(today, -30))).lte("date", dayStartISO(today)),
    supabase.from("properties")
      .select("id, title, status, created_at, operation_type, property_type_id, city, neighborhood, price, currency, bedrooms, bathrooms")
      .eq("agent_id", userId).in("status", ["EN_VENTA", "EN_ALQUILER"]),
  ]);
  const leads = (leadsRaw ?? []) as unknown as Lead[];

  // Último cambio de estado por lead: cuenta como actividad.
  const { data: history } = leads.length
    ? await supabase.from("status_history").select("entity_id, changed_at").eq("entity_type", "lead").in("entity_id", leads.map((l) => l.id))
    : { data: [] };
  const lastChange = new Map<string, string>();
  for (const h of history ?? []) if (!lastChange.has(h.entity_id) || h.changed_at > lastChange.get(h.entity_id)!) lastChange.set(h.entity_id, h.changed_at);

  const tasks: TodayTask[] = [];
  const noNextStep: TodayTask[] = [];

  for (const lead of leads) {
    const status = normalizeStatus(lead.status);
    const property = lead.property?.title;
    const phone = phoneDigits(lead.phone);
    const lastActivity = [lead.created_at, lastChange.get(lead.id), ...lead.notes.map((n) => n.created_at)]
      .filter(Boolean).sort().at(-1)!;
    const idleDays = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / 86_400_000);

    // 1. Próximo paso para hoy o vencido.
    if (lead.next_action && lead.next_action_at && lead.next_action_at <= today) {
      const overdue = daysBetween(lead.next_action_at, today);
      tasks.push({
        key: `PASO:${lead.id}:${lead.next_action_at}`, area: "ventas", category: "seguimiento",
        urgency: overdue > 0 ? "alta" : "media", score: 95 + Math.min(overdue, 20),
        title: `${lead.next_action}: ${lead.name}`,
        detail: [overdue > 0 ? `Vencido hace ${overdue} ${overdue === 1 ? "día" : "días"}` : "Para hoy", property].filter(Boolean).join(" · "),
        link: leadLink(lead.id),
        actions: [
          { type: "complete", leadId: lead.id, label: "Hecho" },
          ...(phone ? [{ type: "whatsapp" as const, label: "WhatsApp", phone, text: `Hola ${firstName(lead.name)}, ¿cómo estás? `, snoozeDays: 1 }] : []),
        ],
      });
      continue;
    }
    if (lead.next_action) continue; // tiene un paso planificado más adelante

    // 2. Consulta nueva sin respuesta.
    if (status === "NUEVO" && lead.notes.length === 0) {
      const waiting = businessMinutes(new Date(lead.created_at), now);
      const hours = Math.round(waiting / 60);
      tasks.push({
        key: `RESPONDER:${lead.id}`, area: "ventas", category: "consultas",
        urgency: waiting > 120 ? "alta" : "media", score: 100 + Math.min(hours, 40),
        title: `Responder a ${lead.name}`,
        detail: [property ? `Consultó por ${property}` : "Consulta nueva", hours >= 1 ? `espera hace ${hours} h hábiles` : "recién llegada"].join(" · "),
        link: leadLink(lead.id),
        actions: phone ? [{
          type: "whatsapp", label: "Responder", phone, snoozeDays: 1,
          text: `Hola ${firstName(lead.name)}, te escribo de ${BRAND.name} por tu consulta${property ? ` sobre ${property}` : ""}. ¿Cuándo te queda cómodo para hablar?`,
        }] : [{ type: "link", label: "Abrir lead", href: `/dashboard/leads/${lead.id}` }],
      });
      continue;
    }

    // Con operación en curso, el seguimiento lo dan las tareas de Operaciones.
    if (lead.deal_stage && lead.deal_stage !== "CAIDA") continue;

    // 3. Negociación frenada.
    if (status === "NEGOCIACIÓN" && idleDays > 10) {
      tasks.push({
        key: `NEGOCIACION:${lead.id}`, area: "ventas", category: "seguimiento",
        urgency: "alta", score: 85 + Math.min(idleDays, 30),
        title: `Retomar la negociación con ${lead.name}`,
        detail: [`Sin novedades hace ${idleDays} días`, property].filter(Boolean).join(" · "),
        link: leadLink(lead.id),
        actions: phone ? [{ type: "whatsapp", label: "Escribir", phone, snoozeDays: 3, text: `Hola ${firstName(lead.name)}, ¿cómo estás? Te escribo para retomar lo que veníamos hablando${property ? ` de ${property}` : ""}.` }]
          : [{ type: "link", label: "Abrir lead", href: `/dashboard/leads/${lead.id}` }],
      });
      continue;
    }

    // 4. Lead abierto sin próximo paso (y sin movimiento hace unos días).
    if (idleDays >= 3) {
      const temperature = getLeadTemperature(status, lastActivity, now);
      noNextStep.push({
        key: `SINPASO:${lead.id}`, area: "ventas", category: "seguimiento",
        urgency: temperature === "frio" ? "media" : "baja", score: 30 + Math.min(idleDays, 30),
        title: `Definí el próximo paso con ${lead.name}`,
        detail: [`Sin actividad hace ${idleDays} días`, property].filter(Boolean).join(" · "),
        link: leadLink(lead.id),
        actions: [{ type: "link", label: "Definir", href: `/dashboard/leads/${lead.id}` }],
      });
    }
  }
  tasks.push(...noNextStep.sort((a, b) => b.score - a.score).slice(0, MAX_NO_NEXT_STEP));

  // 5. Visitas que ya pasaron sin resultado cargado.
  for (const visit of visits ?? []) {
    const day = ymdInAppTz(new Date(visit.date));
    if (day === today && visit.time > new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now)) continue;
    const visitLead = visit.lead as unknown as { name: string; status: string | null } | null;
    // Lead ya cerrado o descartado: el resultado de la visita deja de ser urgente.
    if (["CERRADO", "DESCARTADO"].includes(normalizeStatus(visitLead?.status))) continue;
    const leadName = visitLead?.name ?? "el cliente";
    const property = (visit.property as unknown as { title: string } | null)?.title;
    const ago = daysBetween(day, today);
    tasks.push({
      key: `VISITA:${visit.id}`, area: "ventas", category: "visitas",
      urgency: ago > 2 ? "alta" : "media", score: 80 + Math.min(ago, 20),
      title: `¿Cómo fue la visita con ${leadName}?`,
      detail: [ago === 0 ? "Hoy" : `El ${formatDate(day)}`, property].filter(Boolean).join(" · "),
      link: leadLink(visit.lead_id!),
      actions: [{ type: "link", label: "Cargar resultado", href: `/dashboard/leads/${visit.lead_id}` }],
    });
  }

  // 6 y 7. Propiedades: compradores a avisar y publicaciones sin consultas.
  const active = properties ?? [];
  const recent = active.filter((p) => daysBetween(p.created_at.slice(0, 10), today) <= 14);
  const [{ data: contacted }, { data: recentLeads }] = await Promise.all([
    recent.length ? supabase.from("buyer_contacts").select("property_id, lead_id").in("property_id", recent.map((p) => p.id)) : Promise.resolve({ data: [] }),
    active.length ? supabase.from("leads").select("property_id").in("property_id", active.map((p) => p.id)).gte("created_at", dayStartISO(addDays(today, -30))) : Promise.resolve({ data: [] }),
  ]);
  const done = new Set((contacted ?? []).map((c) => `${c.property_id}|${c.lead_id}`));
  for (const property of recent) {
    const pending = (await findBuyerMatches(supabase, property))
      .filter((m) => m.score >= STRONG_MATCH && !done.has(`${property.id}|${m.lead.id}`));
    if (!pending.length) continue;
    tasks.push({
      key: `COMPRADORES:${property.id}:${pending.length}`, area: "ventas", category: "compradores",
      urgency: "media", score: 70 + pending.length,
      title: `Avisar a ${pending.length} ${pending.length === 1 ? "comprador compatible" : "compradores compatibles"}: ${property.title}`,
      detail: pending.slice(0, 3).map((m) => m.lead.name).join(", ") + (pending.length > 3 ? ` y ${pending.length - 3} más` : ""),
      link: { href: `/dashboard/propiedades/${property.id}`, label: "ver propiedad" },
      actions: [{ type: "link", label: "Ver compradores", href: `/dashboard/propiedades/${property.id}` }],
    });
  }
  const withInterest = new Set((recentLeads ?? []).map((l) => l.property_id));
  active
    .filter((p) => daysBetween(p.created_at.slice(0, 10), today) >= 30 && !withInterest.has(p.id))
    .map((p) => ({ p, days: daysBetween(p.created_at.slice(0, 10), today) }))
    .sort((a, b) => b.days - a.days).slice(0, 5)
    .forEach(({ p }) => tasks.push({
      key: `SINCONSULTAS:${p.id}`, area: "ventas", category: "propiedades",
      urgency: "baja", score: 20,
      title: `Revisá precio o fotos: ${p.title}`,
      detail: "Sin consultas en los últimos 30 días",
      link: { href: `/dashboard/propiedades/${p.id}`, label: "ver propiedad" },
      actions: [{ type: "link", label: "Ver rendimiento", href: `/dashboard/propiedades/${p.id}` }],
    }));

  return tasks;
}
