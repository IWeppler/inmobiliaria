export type Fact = {
  icon: React.ElementType;
  label: string;
  value: number | string;
  unit?: string;
};

// Columnas desde sm según la cantidad de datos: filas completas cuando
// se puede (3 → 3, 4 → 4, 6 → 3+3); 5 queda 3+2.
function factColumns(count: number) {
  return count <= 4 ? count : 3;
}

// Grilla de 12 columnas: cada dato ocupa 12/columnas. Los de la última
// fila, si no la completan, se reparten el ancho: nunca queda un hueco.
const SPAN: Record<number, string> = {
  12: "sm:col-span-12",
  6: "sm:col-span-6",
  4: "sm:col-span-4",
  3: "sm:col-span-3",
};

function factSpan(index: number, count: number) {
  const cols = factColumns(count);
  const lastRowStart = count - (count % cols || cols);
  const perRow = index >= lastRowStart ? count - lastRowStart : cols;
  // En móvil (2 columnas) el último, si queda solo, ocupa la fila entera.
  const mobile = count % 2 === 1 && index === count - 1 ? "col-span-2" : "";
  return `${mobile} ${SPAN[12 / perRow]}`;
}

// Datos principales de la ficha ("La propiedad de un vistazo").
export function KeyFacts({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-12">
      {facts.map((fact, i) => {
        const Icon = fact.icon;
        return (
          <div
            key={fact.label}
            className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 md:p-5 ${factSpan(i, facts.length)}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-main-soft text-main">
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{fact.label}</dt>
              <dd className="font-clash text-2xl leading-tight font-semibold text-foreground">
                {typeof fact.value === "number" ? fact.value.toLocaleString("es-AR") : fact.value}
                {fact.unit && <span className="ml-1 text-base font-medium text-muted-foreground">{fact.unit}</span>}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}

export function FactChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
