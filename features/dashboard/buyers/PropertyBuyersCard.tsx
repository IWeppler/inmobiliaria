import Link from "next/link";
import { Check, TriangleAlert } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { normalizeArPhone } from "@/lib/whatsapp";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { MatchableProperty } from "./matching";
import { findBuyerMatches } from "./queries";
import { BuyerContactControls } from "./BuyerContactControls";
import { outcomeLabel, type Outcome } from "./outcomes";
import { daysAgo } from "./format";

const VISIBLE = 10;
const URGENCY_LABEL: Record<string, string> = { alta: "Urgencia alta", media: "Urgencia media", baja: "Urgencia baja" };

// Buyer Intelligence: compradores de la base que encajan con esta propiedad,
// ordenados por compatibilidad. Los ya contactados por esta propiedad pasan
// al final y los que dijeron "no interesado" se esconden, para no insistir.
// Corre en el servidor; RLS decide qué leads ve cada usuario (un agente, los
// suyos; un admin, todos).
export async function PropertyBuyersCard({
  supabase,
  property,
}: {
  supabase: SupabaseClient<Database>;
  property: MatchableProperty & { id: string; title: string };
}) {
  const matches = await findBuyerMatches(supabase, property);

  // Estado vigente por lead = último registro de contacto por esta propiedad.
  const { data: contacts } = await supabase
    .from("buyer_contacts")
    .select("lead_id, outcome, created_at")
    .eq("property_id", property.id)
    .order("created_at", { ascending: false });
  const latest = new Map<string, { outcome: Outcome; created_at: string }>();
  for (const c of contacts ?? []) {
    if (!latest.has(c.lead_id)) latest.set(c.lead_id, { outcome: c.outcome as Outcome, created_at: c.created_at });
  }

  const status = (id: string) => latest.get(id)?.outcome ?? null;
  const declined = matches.filter((m) => status(m.lead.id) === "no_interesado").length;
  const active = matches.filter((m) => status(m.lead.id) !== "no_interesado");
  // Sin contactar primero; dentro de cada grupo se mantiene el orden por score.
  const ordered = [...active.filter((m) => !status(m.lead.id)), ...active.filter((m) => status(m.lead.id))];
  const shown = ordered.slice(0, VISIBLE);
  const pending = active.filter((m) => !status(m.lead.id)).length;

  // Último contacto general = nota más reciente del lead (o su alta).
  const lastNote = new Map<string, string>();
  if (shown.length) {
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("lead_id, created_at")
      .in("lead_id", shown.map((m) => m.lead.id))
      .order("created_at", { ascending: false });
    for (const n of notes ?? []) if (n.lead_id && !lastNote.has(n.lead_id)) lastNote.set(n.lead_id, n.created_at);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Compradores potenciales
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            {active.length}
            {pending !== active.length && ` · ${pending} sin contactar`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {matches.length === 0
              ? "Ningún comprador de tu base encaja con esta propiedad. Cargá qué busca cada lead desde su ficha para que aparezcan acá."
              : "Todos los compradores compatibles ya dijeron que no les interesa."}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {shown.map(({ lead, result, demand }) => {
              const wa = lead.phone ? normalizeArPhone(lead.phone) : null;
              const msg = encodeURIComponent(
                `Hola ${lead.name.split(" ")[0]}, te escribo de la inmobiliaria. Entró una propiedad que puede interesarte: ${property.title}. ¿Querés que te pase los detalles?`,
              );
              const current = status(lead.id);
              const contactDays = daysAgo(lastNote.get(lead.id) ?? lead.created_at);
              return (
                <li key={lead.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {current && <StatusBadge tone="neutral">{outcomeLabel(current)}</StatusBadge>}
                      <StatusBadge tone={result.score >= 80 ? "success" : result.score >= 55 ? "info" : "neutral"}>
                        {result.score}%
                      </StatusBadge>
                      <BuyerContactControls
                        leadId={lead.id}
                        propertyId={property.id}
                        leadName={lead.name}
                        waHref={wa ? `https://wa.me/${wa}?text=${msg}` : null}
                        current={current}
                      />
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {result.reasons.map((r) => (
                      <li key={r.text} className="flex items-center gap-1">
                        {r.ok ? <Check className="size-3 text-success" /> : <TriangleAlert className="size-3 text-warning" />}
                        {r.text}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    {[
                      demand.urgency ? URGENCY_LABEL[demand.urgency] : null,
                      demand.financing ? "Con financiación" : null,
                      contactDays === null ? null : contactDays === 0 ? "Contactado hoy" : `Último contacto hace ${contactDays} d`,
                      result.stale ? "Búsqueda sin confirmar hace tiempo" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              );
            })}
            {active.length > VISIBLE && (
              <li className="pt-3 text-xs text-muted-foreground">+{active.length - VISIBLE} más</li>
            )}
          </ul>
        )}
        {declined > 0 && (
          <p className="mt-3 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
            {declined} {declined === 1 ? "comprador dijo" : "compradores dijeron"} que no les interesa y no se muestran.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
