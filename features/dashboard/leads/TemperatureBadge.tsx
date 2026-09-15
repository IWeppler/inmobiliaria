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

// E1.8: badge de temperatura. No renderiza nada en estados terminales ni
// cuando el lead no viene enriquecido con last_activity_at.
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        meta.className,
        className
      )}
    >
      <Icon className="size-3 shrink-0" />
      {!iconOnly && meta.label}
    </span>
  );
}
