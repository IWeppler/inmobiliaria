"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/dates";
import { formatDate, money } from "@/features/rentals/logic";
import { phoneDigits } from "@/features/rentals/tasks";
import { setRenewalIntentAction, setRentalListingAction } from "@/features/rentals/vacancyActions";
import { useRunAction } from "@/features/rentals/useRunAction";
import {
  renewalMessage, STAGE_LABELS, STAGE_TONE, type ExpiringItem, type RenewalIntent, type VacantItem,
} from "@/features/rentals/vacancy";

const INTENTS: { value: RenewalIntent; label: string }[] = [
  { value: null, label: "Sin definir" },
  { value: "RENUEVA", label: "Renueva" },
  { value: "NO_RENUEVA", label: "Se va" },
];

// Vacancia: lo que se va a desocupar y lo que ya está vacío, con la
// próxima acción en cada fila.
export function VacancyView({ expiring, vacant, windowDays }: { expiring: ExpiringItem[]; vacant: VacantItem[]; windowDays: number }) {
  const { busy, run } = useRunAction();

  const publish = (propertyId: string, availableFrom: string | null) =>
    run(`pub-${propertyId}`, () => setRentalListingAction({ property_id: propertyId, status: "EN_ALQUILER", available_from: availableFrom }));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Vencen en los próximos {windowDays} días</h2>
        {expiring.length === 0 ? (
          <Empty text="Ningún contrato vence sin renovación en este período." />
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
            {expiring.map((item) => {
              const phone = phoneDigits(item.tenantPhone);
              const availableFrom = addDays(item.endDate, 1);
              return (
                <li key={item.contractId} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,16rem)] lg:items-center">
                  <div className="min-w-0">
                    <Link href={`/dashboard/alquileres/${item.contractId}`} className="text-sm font-medium underline-offset-4 hover:underline">
                      {item.propertyTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.tenantName ?? "Sin inquilino"} ·{" "}
                      <span className={cn(item.daysLeft <= 30 && "font-medium text-danger")}>
                        {item.daysLeft >= 0 ? `vence el ${formatDate(item.endDate)} (en ${item.daysLeft} días)` : `venció hace ${-item.daysLeft} días`}
                      </span>
                    </p>
                  </div>

                  <div role="radiogroup" aria-label="¿Renueva?" className="inline-flex h-8 rounded-md bg-muted p-[3px] text-xs">
                    {INTENTS.map((option) => (
                      <button key={option.label} type="button" role="radio" aria-checked={item.intent === option.value}
                        disabled={!!busy}
                        onClick={() => item.intent !== option.value && run(`intent-${item.contractId}`, () => setRenewalIntentAction({ contract_id: item.contractId, intent: option.value }))}
                        className={cn("rounded px-2.5 font-medium transition-colors",
                          item.intent === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {item.intent === null && phone && item.tenantName && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`https://wa.me/${phone}?text=${encodeURIComponent(renewalMessage({ tenantName: item.tenantName, propertyTitle: item.propertyTitle, endDate: item.endDate }))}`}
                          target="_blank" rel="noopener noreferrer">
                          <FaWhatsapp className="size-4" aria-hidden /> Consultar
                        </a>
                      </Button>
                    )}
                    {item.intent === "RENUEVA" && (
                      <Button asChild size="sm"><Link href={`/dashboard/alquileres/nuevo?renovar=${item.contractId}`}>Renovar</Link></Button>
                    )}
                    {item.intent === "NO_RENUEVA" && !item.published && item.canPublish && (
                      <Button size="sm" disabled={!!busy} onClick={() => publish(item.propertyId, availableFrom)}>
                        {busy === `pub-${item.propertyId}` && <Loader2 className="size-4 animate-spin" />} Publicar
                      </Button>
                    )}
                    {item.intent === "NO_RENUEVA" && item.published && (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Publicada{item.availableFrom ? `, disponible el ${formatDate(item.availableFrom)}` : ""} · {item.leads30} {item.leads30 === 1 ? "consulta" : "consultas"}
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/alquileres/nuevo?propiedad=${item.propertyId}`}>Próximo contrato</Link>
                        </Button>
                      </>
                    )}
                    {item.intent === "NO_RENUEVA" && !item.published && !item.canPublish && (
                      <span className="text-xs text-muted-foreground">Pedile al responsable que la publique</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Vacantes</h2>
        {vacant.length === 0 ? (
          <Empty text="No hay propiedades de alquiler sin contrato." />
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
            {vacant.map((item) => (
              <li key={item.propertyId} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/propiedades/${item.propertyId}`} className="text-sm font-medium underline-offset-4 hover:underline">
                      {item.propertyTitle}
                    </Link>
                    <StatusBadge tone={STAGE_TONE[item.stage]}>{STAGE_LABELS[item.stage]}</StatusBadge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.neverRented
                      ? `Sin contrato desde el alta, hace ${item.daysVacant} días`
                      : item.daysVacant > 0 ? `Vacante hace ${item.daysVacant} días` : `Libre desde el ${formatDate(item.vacantSince)}`}
                    {item.lostRent ? ` · ${money(item.lostRent, item.currency)} sin cobrar (estimado)` : ""}
                    {item.status === "ALQUILADO" ? " · figura alquilada pero no tiene contrato activo" : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.leads30} {item.leads30 === 1 ? "consulta" : "consultas"} en 30 días
                  {item.nextVisit ? ` · visita el ${formatDate(item.nextVisit)}` : item.lastLeadAt ? ` · última el ${formatDate(item.lastLeadAt)}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {item.stage === "SIN_PUBLICAR" && item.canPublish && (
                    <Button size="sm" disabled={!!busy} onClick={() => publish(item.propertyId, null)}>
                      {busy === `pub-${item.propertyId}` && <Loader2 className="size-4 animate-spin" />} Publicar
                    </Button>
                  )}
                  {(item.stage === "CON_CONSULTAS" || item.stage === "VISITAS" || item.stage === "SIN_CONSULTAS") && item.canPublish && (
                    <Button size="sm" variant="outline" disabled={!!busy}
                      onClick={() => run(`res-${item.propertyId}`, () => setRentalListingAction({ property_id: item.propertyId, status: "RESERVADO" }))}>
                      Reservar
                    </Button>
                  )}
                  {item.stage === "RESERVADA" && item.canPublish && (
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => publish(item.propertyId, null)}>Liberar reserva</Button>
                  )}
                  <Button asChild size="sm" variant={item.stage === "RESERVADA" ? "default" : "outline"}>
                    <Link href={`/dashboard/alquileres/nuevo?propiedad=${item.propertyId}`}>Nuevo contrato</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      <CheckCircle2 className="size-5 text-success" aria-hidden /> {text}
    </div>
  );
}
