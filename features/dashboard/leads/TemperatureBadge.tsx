import { cn } from "@/lib/utils";
import {
  getLeadTemperature,
  TEMPERATURE_META,
} from "@/features/dashboard/leads/leadStatus";

type Props = {
  status: string | null | undefined;
  lastActivityAt: string | undefined;
  className?: string;
  iconOnly?: boolean;
};

// E1.8: temperatura del lead. Es el único badge con borde de color: el
// ícono y el borde comparten el tono para que se escanee de un vistazo;
// el texto sigue neutro. No renderiza nada en estados terminales ni sin
// last_activity_at.
export function TemperatureBadge({
  status,
  lastActivityAt,
  className,
  iconOnly,
}: Props) {
  if (!lastActivityAt) return null;
  const temp = getLeadTemperature(status, lastActivityAt);
  if (!temp) return null;
  const meta = TEMPERATURE_META[temp];
  const Icon = meta.icon;
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      style={{
        color: meta.color,
        borderColor: `color-mix(in srgb, ${meta.color} 55%, transparent)`,
      }}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border bg-card text-xs font-medium",
        iconOnly ? "w-5 justify-center" : "px-1.5",
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {!iconOnly && <span className="text-foreground">{meta.label}</span>}
    </span>
  );
}
