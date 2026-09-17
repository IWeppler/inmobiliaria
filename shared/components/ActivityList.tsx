import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

export type ActivityItem = {
  id: string;
  at: string;
  /** Texto principal, ej. "Juan Pérez consultó". */
  text: React.ReactNode;
  /** Detalle secundario, ej. "por WhatsApp". */
  meta?: React.ReactNode;
  href?: string;
};

function when(at: string) {
  const d = new Date(at);
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "d MMM", { locale: es });
}

// Timeline plano compartido por los detalles de entidad: fecha relativa a
// la izquierda (columna fija), texto a la derecha. Sin íconos ni puntos:
// la cronología la da el orden.
export function ActivityList({
  items,
  emptyText = "Sin actividad todavía.",
  limit,
}: {
  items: ActivityItem[];
  emptyText?: string;
  limit?: number;
}) {
  const visible = limit ? items.slice(0, limit) : items;
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {visible.map((it) => (
        <li key={it.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
          <span
            className="w-12 shrink-0 pt-px text-xs text-muted-foreground"
            title={format(new Date(it.at), "d MMM yyyy HH:mm", { locale: es })}
          >
            {when(it.at)}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            {it.href ? (
              <Link
                href={it.href}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {it.text}
              </Link>
            ) : (
              <span className="text-foreground">{it.text}</span>
            )}
            {it.meta && (
              <span className="text-muted-foreground"> · {it.meta}</span>
            )}
          </div>
        </li>
      ))}
      {limit && items.length > limit && (
        <li className="pt-2 text-xs text-muted-foreground">
          +{items.length - limit} más
        </li>
      )}
    </ul>
  );
}
