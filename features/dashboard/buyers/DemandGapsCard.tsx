import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { DemandGap } from "./queries";

const usd = (n: number) => `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;

// Demanda sin oferta: lo que buscan los compradores y hoy no tenés. Es la
// lista de qué salir a captar.
export function DemandGapsCard({ gaps }: { gaps: DemandGap[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demanda sin oferta</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compradores a los que hoy no les encaja ninguna propiedad disponible, por zona.
        </p>
      </CardHeader>
      <CardContent>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos los compradores con búsqueda tienen al menos una propiedad que les encaja.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {gaps.map((g) => (
              <li key={`${g.operation}-${g.zone}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {g.operation === "venta" ? "Comprar" : "Alquilar"} · {g.zone || "Sin zona definida"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      g.budgetMedianUsd ? `Presupuesto típico ${usd(g.budgetMedianUsd)}` : null,
                      g.urgent ? `${g.urgent} con urgencia alta` : null,
                      g.financed ? `${g.financed} con financiación` : null,
                      `${g.supply} ${g.supply === 1 ? "propiedad disponible" : "propiedades disponibles"} en la zona`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {g.buyers} {g.buyers === 1 ? "comprador" : "compradores"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
