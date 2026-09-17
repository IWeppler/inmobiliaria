"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase-browser";
import type { PropertyWithDetails } from "@/app/types/entities";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Instagram,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  List,
  Map as MapIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  PROPERTY_STATUSES,
  propertyStatusMeta,
  operationLabel,
  formatPrice,
  type PropertyStatus,
} from "@/features/dashboard/property/propertyStatus";
import { cn } from "@/lib/utils";
import { PropertiesMapView } from "@/features/dashboard/property/PropertiesMapView";

type PropertyTableProps = {
  initialProperties: PropertyWithDetails[];
  currentUserId: string;
  currentUserRole: string;
  /** Dashboard: sin filtros de estado/operación, sin responsable ni visitas. */
  compact?: boolean;
  /** Filas por página. */
  pageSize?: number;
  /** Filtro de estado inicial (p. ej. desde ?estado= en la URL). */
  initialStatus?: string;
};

const ALL = "__all__";

type SortKey = "created_at" | "title" | "city" | "operation_type" | "price" | "status" | "agent" | "views_count";
type Sort = { key: SortKey; dir: "asc" | "desc" };

// Header clickeable: primer click ordena asc (desc para fecha/precio/vistas),
// segundo invierte. La flecha solo aparece en la columna activa.
function SortableHead({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex h-full items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {label}
        <Arrow className={cn("size-3 transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </button>
    </TableHead>
  );
}

// Lectura de una propiedad en una fila: foto → nombre → ubicación →
// operación → precio → estado → responsable → acciones. Filas de 40px,
// thumbnail de 32, acciones visibles al hover.
export function PropertyTable({
  initialProperties,
  currentUserId,
  currentUserRole,
  compact,
  pageSize = 25,
  initialStatus,
}: PropertyTableProps) {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [properties, setProperties] = useState(initialProperties);
  const [isDeleting, setIsDeleting] = useState(false);
  const [propertyToDelete, setPropertyToDelete] =
    useState<PropertyWithDetails | null>(null);

  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    initialStatus && PROPERTY_STATUSES.some((s) => s.value === initialStatus) ? initialStatus : ALL,
  );
  const [operationFilter, setOperationFilter] = useState(ALL);
  const [sort, setSort] = useState<Sort>({ key: "created_at", dir: "desc" });
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "map">("list");

  const isAdmin = currentUserRole === "admin";

  const rows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = properties.filter((p) => {
      if (
        q &&
        !(
          p.title?.toLowerCase().includes(q) ||
          p.street_address?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q)
        )
      )
        return false;
      if (statusFilter !== ALL && p.status !== statusFilter) return false;
      if (
        operationFilter !== ALL &&
        p.operation_type?.toLowerCase() !== operationFilter
      )
        return false;
      return true;
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    const str = (v: string | null | undefined) => (v ?? "").toLowerCase();
    filtered.sort((a, b) => {
      switch (sort.key) {
        case "title":
          return dir * str(a.title).localeCompare(str(b.title));
        case "city":
          return dir * str(a.city).localeCompare(str(b.city));
        case "operation_type":
          return dir * str(a.operation_type).localeCompare(str(b.operation_type));
        case "price":
          return dir * ((a.price || 0) - (b.price || 0));
        case "status":
          return dir * str(a.status).localeCompare(str(b.status));
        case "agent":
          return dir * str(a.agents?.full_name).localeCompare(str(b.agents?.full_name));
        case "views_count":
          return dir * ((a.views_count || 0) - (b.views_count || 0));
        default:
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });
    return filtered;
  }, [properties, filterText, statusFilter, operationFilter, sort]);

  const toggleSort = (key: SortKey) => {
    setPage(0);
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "price" || key === "views_count" || key === "created_at" ? "desc" : "asc" },
    );
  };

  const handleStatusChange = async (
    propertyId: number | string,
    newStatus: PropertyStatus,
  ) => {
    const oldProperties = [...properties];
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, status: newStatus as PropertyWithDetails["status"] }
          : p,
      ),
    );

    const toastId = toast.loading("Actualizando estado…");
    try {
      const { data, error } = await supabase
        .from("properties")
        .update({ status: newStatus })
        .eq("id", propertyId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No tenés permisos para editar esta propiedad.");
      }
      toast.success("Estado actualizado", { id: toastId });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error updating:", error);
      setProperties(oldProperties);
      toast.error(message, { id: toastId });
    }
  };

  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Eliminando propiedad…");

    const imagePaths =
      propertyToDelete.property_images?.map((img) => img.image_url) || [];
    if (imagePaths.length > 0) {
      const pathsToDelete = imagePaths
        .filter(Boolean)
        .map((url) => url?.split("/properties/").pop() || "");
      if (pathsToDelete.length > 0) {
        await supabase.storage.from("properties").remove(pathsToDelete);
      }
    }

    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", propertyToDelete.id);

    setIsDeleting(false);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`, { id: toastId });
    } else {
      toast.success("Propiedad eliminada.", { id: toastId });
      setProperties((prev) => prev.filter((p) => p.id !== propertyToDelete.id));
      router.refresh();
    }
    setPropertyToDelete(null);
  };

  const hasFilters =
    filterText.trim() !== "" || statusFilter !== ALL || operationFilter !== ALL;
  const unlocated = rows.filter(
    (p) => typeof p.latitude !== "number" || typeof p.longitude !== "number",
  ).length;

  // Paginación client-side sobre el resultado filtrado. Si un filtro deja
  // la página actual fuera de rango, se vuelve a la última válida.
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const from = rows.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(rows.length, (safePage + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: búsqueda, filtros, orden, conteo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar propiedad…"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(0);
            }}
            className="pl-8"
            aria-label="Buscar por título, dirección o ciudad"
          />
        </div>

        {!compact && (
          <>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]" aria-label="Estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los estados</SelectItem>
                {PROPERTY_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={operationFilter} onValueChange={(v) => { setOperationFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]" aria-label="Operación">
                <SelectValue placeholder="Operación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Venta y alquiler</SelectItem>
                <SelectItem value="venta">Venta</SelectItem>
                <SelectItem value="alquiler">Alquiler</SelectItem>
              </SelectContent>
            </Select>

          </>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "resultado" : "resultados"}
          {view === "map" && unlocated > 0 && (
            <span title="Propiedades sin coordenadas cargadas"> · {unlocated} sin ubicación</span>
          )}
        </span>

        {!compact && (
          <div className="flex rounded-md border border-border bg-card p-0.5" role="group" aria-label="Vista">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ver como lista"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn("size-7", view === "list" ? "bg-muted text-foreground" : "text-muted-foreground")}
            >
              <List />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ver en el mapa"
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
              className={cn("size-7", view === "map" ? "bg-muted text-foreground" : "text-muted-foreground")}
            >
              <MapIcon />
            </Button>
          </div>
        )}
      </div>

      {view === "map" ? (
        <PropertiesMapView properties={rows} />
      ) : (

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <SortableHead label="Propiedad" column="title" sort={sort} onSort={toggleSort} />
              <SortableHead label="Ubicación" column="city" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
              <SortableHead label="Operación" column="operation_type" sort={sort} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortableHead label="Precio" column="price" sort={sort} onSort={toggleSort} />
              <SortableHead label="Estado" column="status" sort={sort} onSort={toggleSort} />
              <SortableHead label="Responsable" column="agent" sort={sort} onSort={toggleSort} className={cn("hidden", !compact && "xl:table-cell")} />
              <SortableHead label="Visitas" column="views_count" sort={sort} onSort={toggleSort} className={cn("hidden text-right", !compact && "xl:table-cell")} />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {hasFilters
                    ? "Ninguna propiedad coincide con los filtros."
                    : "Todavía no hay propiedades cargadas."}
                </TableCell>
              </TableRow>
            )}

            {pageRows.map((property) => {
              const canEdit = isAdmin || property.agent_id === currentUserId;
              const mainImage = property.property_images?.[0]?.image_url;
              const price = formatPrice(property.price, property.currency);
              const meta = propertyStatusMeta(property.status);
              const StatusIcon = meta.icon;
              const location = [property.street_address, property.city]
                .filter(Boolean)
                .join(" · ");

              return (
                <TableRow key={property.id} className="group">
                  <TableCell className="py-1">
                    <div className="relative size-8 overflow-hidden rounded-sm bg-muted">
                      {mainImage && (
                        <Image
                          src={mainImage}
                          alt=""
                          fill
                          sizes="32px"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="max-w-[280px] font-medium">
                    <Link
                      href={`/dashboard/propiedades/${property.id}`}
                      className="block truncate text-foreground underline-offset-4 hover:underline"
                      title={property.title}
                    >
                      {property.title}
                    </Link>
                  </TableCell>

                  <TableCell className="hidden max-w-[240px] truncate text-fg-secondary md:table-cell">
                    {location || "—"}
                  </TableCell>

                  <TableCell className="hidden text-fg-secondary lg:table-cell">
                    {operationLabel(property.operation_type)}
                  </TableCell>

                  <TableCell className="font-medium">
                    {price ?? (
                      <span className="text-muted-foreground">Consultar</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {canEdit ? (
                      <Select
                        value={property.status ?? undefined}
                        onValueChange={(val) =>
                          handleStatusChange(property.id, val as PropertyStatus)
                        }
                      >
                        <SelectTrigger
                          aria-label="Cambiar estado"
                          className={cn(
                            "h-5 min-w-0 gap-1.5 rounded-sm border-border bg-card px-1.5 py-0 text-xs font-medium",
                            "[&>svg]:size-3 [&>svg]:opacity-0 [&>svg]:transition-opacity group-hover:[&>svg]:opacity-60 data-[state=open]:[&>svg]:opacity-60",
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <StatusIcon
                              className="size-3 shrink-0"
                              style={{ color: meta.color }}
                              aria-hidden
                            />
                            {meta.label}
                          </span>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {PROPERTY_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              <span className="flex items-center gap-2">
                                <s.icon
                                  className="size-3.5"
                                  style={{ color: s.color }}
                                />
                                {s.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge tone={meta.tone} color={meta.color} icon={StatusIcon}>
                        {meta.label}
                      </StatusBadge>
                    )}
                  </TableCell>

                  <TableCell className={cn("hidden max-w-[160px] truncate text-fg-secondary", !compact && "xl:table-cell")}>
                    {property.agents?.full_name ?? "—"}
                  </TableCell>

                  <TableCell className={cn("hidden text-right text-muted-foreground", !compact && "xl:table-cell")}>
                    {property.views_count || 0}
                  </TableCell>

                  <TableCell className="py-0 pr-2">
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Más acciones"
                            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/propiedades/editar/${property.id}`}
                            >
                              <Pencil /> Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/propiedades/pdf/${property.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText /> Ficha PDF
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/propiedades/instagram/${property.id}`}
                            >
                              <Instagram /> Pieza Instagram
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPropertyToDelete(property)}
                          >
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {pageCount > 1 && (
          <div className="flex h-10 items-center justify-between border-t border-border px-3 text-xs text-muted-foreground">
            <span>
              {from}–{to} de {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Página anterior"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-12 text-center">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Página siguiente"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>

      )}

      <AlertDialog
        open={!!propertyToDelete}
        onOpenChange={(open) => !open && setPropertyToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar propiedad</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina{" "}
              <span className="font-medium text-foreground">
                {propertyToDelete?.title}
              </span>{" "}
              y sus imágenes de forma permanente. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
