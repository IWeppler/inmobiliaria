import { Skeleton } from "@/shared/components/ui/skeleton";

// Usar como fallback de `loading.tsx` en la ruta de reportes. Refleja el
// orden real: métricas 2×2 + embudo, origen, respuesta, cartera y demanda.
export function ReportsSkeleton() {
  return (
    <div className="space-y-10" aria-busy aria-label="Cargando reportes">
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[380px]" />
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-80" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-96" />
        <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
