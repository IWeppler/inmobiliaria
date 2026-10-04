"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { createPortalLinkAction, revokePortalLinkAction } from "@/features/rentals/portalActions";
import { formatDate } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

export type PortalLink = {
  id: string; created_at: string; expires_at: string; revoked_at: string | null; last_viewed_at: string | null; view_count: number;
};

// Links privados para que la persona vea su estado de cuenta sin usuario.
// El link completo se muestra solo al generarlo (en la base queda el hash).
export function PortalLinksPanel({ contactId, contactName, phone, links, now }: {
  contactId: string; contactName: string; phone: string | null; links: PortalLink[]; now: string;
}) {
  const { busy, run } = useRunAction();
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string } | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const res = await createPortalLinkAction(contactId);
      if (res.success && res.data) { setFresh(res.data); toast.success(res.message); }
      else toast.error(res.message);
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Link copiado."); }
    catch { toast.error("No se pudo copiar. Seleccionalo y copialo a mano."); }
  };

  const digits = phone?.replace(/\D/g, "") ?? "";
  const whatsapp = fresh && digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hola ${contactName}, acá podés ver tu estado de cuenta actualizado: ${fresh.url}`)}`
    : null;
  const active = links.filter((l) => !l.revoked_at && l.expires_at > now);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Compartir estado de cuenta</h2>
          <p className="text-muted-foreground">Un link privado de solo lectura, sin usuario ni contraseña. Vence a los 90 días y se puede revocar.</p>
        </div>
        <Button variant="outline" onClick={create} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Link2 />} Generar link
        </Button>
      </div>

      {fresh && (
        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
          <p className="text-xs font-medium">Copialo ahora: por seguridad no se vuelve a mostrar. Vence el {formatDate(fresh.expiresAt)}.</p>
          <div className="flex gap-2">
            <Input readOnly value={fresh.url} onFocus={(e) => e.currentTarget.select()} aria-label="Link de estado de cuenta" />
            <Button size="icon" variant="outline" aria-label="Copiar link" onClick={() => copy(fresh.url)}><Copy /></Button>
          </div>
          {whatsapp
            ? <Button asChild size="sm" variant="outline"><a href={whatsapp} target="_blank" rel="noopener noreferrer"><FaWhatsapp className="size-4" aria-hidden /> Enviar por WhatsApp</a></Button>
            : <p className="text-xs text-muted-foreground">Sin teléfono cargado: copiá el link y mandalo por otro medio.</p>}
        </div>
      )}

      {links.length > 0 && (
        <ul className="divide-y divide-border-subtle">
          {links.map((link) => {
            const expired = link.expires_at <= now;
            const state = link.revoked_at ? { label: "Revocado", tone: "neutral" as const }
              : expired ? { label: "Vencido", tone: "neutral" as const }
              : { label: "Activo", tone: "success" as const };
            return (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-muted-foreground">
                  Creado {formatDate(link.created_at)} · vence {formatDate(link.expires_at)} ·{" "}
                  {link.view_count ? `${link.view_count} ${link.view_count === 1 ? "visita" : "visitas"}, la última el ${formatDate(link.last_viewed_at)}` : "sin abrir"}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                  {!link.revoked_at && !expired && (
                    <Button size="sm" variant="ghost" disabled={!!busy}
                      onClick={() => run(`revoke-${link.id}`, () => revokePortalLinkAction(link.id, contactId))}>
                      Revocar
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {links.length > 0 && active.length === 0 && !fresh && (
        <p className="text-xs text-muted-foreground">No hay links activos. Generá uno nuevo para compartir.</p>
      )}
    </section>
  );
}
