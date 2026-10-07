import { Ban, CheckCircle2, Hand, MessageSquareWarning, Receipt, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_TZ } from "@/lib/dates";
import { money } from "@/features/rentals/logic";

// Historial del contrato: quién informó, quién confirmó, quién anuló y
// cuándo. Lo escriben triggers de la base (rental_activity), así que cubre
// cobros del portal, de WhatsApp, a mano y conciliados.

export type ActivityRow = {
  id: string; at: string; actor_kind: string; action: string; detail: string | null;
  amount: number | null; currency: string | null;
  agent: { full_name: string } | null;
  contact: { full_name: string } | null;
};

const ACTIONS: Record<string, { icon: LucideIcon; tone: string }> = {
  PAGO_INFORMADO: { icon: Hand, tone: "text-info" },
  PAGO_CONFIRMADO: { icon: CheckCircle2, tone: "text-success" },
  COBRO_REGISTRADO: { icon: Receipt, tone: "text-success" },
  PAGO_RECHAZADO: { icon: XCircle, tone: "text-danger" },
  COBRO_ANULADO: { icon: Undo2, tone: "text-warning" },
  RECLAMO_INFORMADO: { icon: MessageSquareWarning, tone: "text-warning" },
  MENSAJE_DESCARTADO: { icon: Ban, tone: "text-muted-foreground" },
};

// Zona horaria fija: el mismo texto en servidor y cliente.
const when = new Intl.DateTimeFormat("es-AR", {
  timeZone: APP_TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function actorName(row: ActivityRow) {
  if (row.actor_kind === "CONTACTO") return row.contact?.full_name ?? "El inquilino";
  if (row.actor_kind === "AGENTE") return row.agent?.full_name ?? "Un usuario";
  return null; // Sistema o registro previo al historial: sin autor conocido.
}

export function ActivityTab({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Todavía no hay movimientos registrados.</p>;
  }
  return (
    <ol className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
      {rows.map((row) => {
        const meta = ACTIONS[row.action] ?? { icon: Receipt, tone: "text-muted-foreground" };
        const actor = actorName(row);
        return (
          <li key={row.id} className="flex items-start gap-3 px-4 py-3 text-sm">
            <meta.icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p>
                {actor && <span className="font-medium">{actor} </span>}
                {actor ? lowerFirst(row.detail) : row.detail}
              </p>
              <p className="text-xs text-muted-foreground">
                {when.format(new Date(row.at))}
                {row.actor_kind === "CONTACTO" && " · desde fuera del panel"}
              </p>
            </div>
            {row.amount !== null && <span className="shrink-0 tabular-nums">{money(row.amount, row.currency ?? "ARS")}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const lowerFirst = (text: string | null) => (text ? text[0].toLowerCase() + text.slice(1) : "");
