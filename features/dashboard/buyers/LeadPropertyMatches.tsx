import Link from "next/link";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatPrice } from "@/features/dashboard/property/propertyStatus";
import type { PropertyMatch } from "./queries";

// Vista inversa de Buyer Intelligence: propiedades disponibles que encajan
// con lo que busca este lead.
export function LeadPropertyMatches({ matches }: { matches: PropertyMatch[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Propiedades para esta búsqueda
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">{matches.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguna propiedad disponible encaja por ahora.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {matches.map(({ property, result }) => (
              <li key={property.id} className="space-y-0.5 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/dashboard/propiedades/${property.id}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                    title={property.title}
                  >
                    {property.title}
                  </Link>
                  <StatusBadge tone={result.score >= 80 ? "success" : result.score >= 55 ? "info" : "neutral"}>
                    {result.score}%
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[property.city, formatPrice(property.price, property.currency)].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
