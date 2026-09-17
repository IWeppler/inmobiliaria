import { cn } from "@/lib/utils";

// Único componente para estados de dominio. Patrón "ícono con color +
// texto neutro": el color vive solo en el ícono (o el punto); texto, fondo y
// borde son neutros. (La temperatura de lead sí lleva borde de color: ver
// TemperatureBadge.) Los tonos son los cuatro semánticos + acento +
// neutro; nunca un color por estado.
export type StatusTone =
  | "neutral"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "danger";

// Colores "vivid": pensados para íconos y puntos, no para texto.
export const STATUS_TONE_COLOR: Record<StatusTone, string> = {
  neutral: "var(--neutral-vivid)",
  accent: "var(--accent-vivid)",
  info: "var(--info-vivid)",
  success: "var(--success-vivid)",
  warning: "var(--warning-vivid)",
  danger: "var(--danger-vivid)",
};

export type StatusIconComponent = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

type StatusBadgeProps = React.ComponentProps<"span"> & {
  tone?: StatusTone;
  /** Color explícito del ícono/punto; pisa al del tono (estados de propiedad). */
  color?: string;
  icon?: StatusIconComponent;
  /** Solo el ícono/punto, con `title` para el label. */
  iconOnly?: boolean;
};

export function StatusBadge({
  tone = "neutral",
  color: colorProp,
  icon: Icon,
  iconOnly,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const color = colorProp ?? STATUS_TONE_COLOR[tone];
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-border bg-card px-1.5 text-xs font-medium text-foreground",
        iconOnly && "w-5 justify-center px-0",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <Icon className="size-3 shrink-0" style={{ color }} aria-hidden />
      ) : (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {!iconOnly && children}
    </span>
  );
}
