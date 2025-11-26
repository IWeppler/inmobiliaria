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
  Edit,
  Trash,
  ArrowUpDown,
  Loader2,
  Shield,
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
  DropdownMenuLabel,
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

type PropertyTableProps = {
  initialProperties: PropertyWithDetails[];
  currentUserId: string;
  currentUserRole: string;
};

export function PropertyTable({
  initialProperties,
  currentUserId,
  currentUserRole,
}: PropertyTableProps) {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [properties, setProperties] = useState(initialProperties);
  const [isDeleting, setIsDeleting] = useState(false);
  const [propertyToDelete, setPropertyToDelete] =
    useState<PropertyWithDetails | null>(null);
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");

  // Colores (Sin cambios)
  const statusColors: { [key: string]: string } = {
    EN_VENTA: "bg-[#77aafe] text-[#00146b] border-[#77aafe]",
    EN_ALQUILER: "bg-[#23c56f] text-[#012e01] border-[#23c56f]",
    RESERVADO: "bg-[#fb6f7a] text-[#650100] border-[#fb6f7a]",
    VENDIDO: "bg-[#fed440] text-[#6a3f03] border-[#fed440]",
    ALQUILADO: "bg-[#f47a49] text-[#5f0101] border-[#f47a49]",
  };

  const statusLabels: { [key: string]: string } = {
    EN_VENTA: "En Venta",
    EN_ALQUILER: "En Alquiler",
    RESERVADO: "Reservado",
    VENDIDO: "Vendido",
    ALQUILADO: "Alquilado",
  };

  const filteredAndSortedProperties = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();
    const filtered = properties.filter(
      (prop) =>
        prop.title?.toLowerCase().includes(lowerFilter) ||
        prop.street_address?.toLowerCase().includes(lowerFilter) ||
        prop.city?.toLowerCase().includes(lowerFilter)
    );

    switch (sortBy) {
      case "price_asc":
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price_desc":
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "city_asc":
        filtered.sort((a, b) => (a.city || "").localeCompare(b.city || ""));
        break;
      case "created_at_desc":
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }
    return filtered;
  }, [properties, filterText, sortBy]);

  const handleStatusChange = async (
    propertyId: number | string,
    newStatus: string
  ) => {
    const oldProperties = [...properties];

    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, status: newStatus as any } : p
      )
    );

    const toastId = toast.loading("Actualizando estado...");

    try {
      const { data, error } = await supabase
        .from("properties")
        .update({ status: newStatus })
        .eq("id", propertyId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("No tienes permisos para editar esta propiedad (RLS).");
      }

      toast.success("Estado actualizado", { id: toastId });
      router.refresh();
    } catch (error: any) {
      console.error("Error updating:", error);
      setProperties(oldProperties);
      toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;

    setIsDeleting(true);
    const toastId = toast.loading("Eliminando propiedad...");

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
      toast.success("Propiedad eliminada con éxito.", { id: toastId });
      setProperties((prev) => prev.filter((p) => p.id !== propertyToDelete.id));
      router.refresh();
    }
    setPropertyToDelete(null);
  };

  return (
    <>
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <Input
          placeholder="Buscar por título, dirección o ciudad..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 py-2"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-[220px] bg-white border border-zinc-200">
            <SelectValue placeholder="Ordenar por..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at_desc">Más Recientes</SelectItem>
            <SelectItem value="price_desc">Precio: Más Caro</SelectItem>
            <SelectItem value="price_asc">Precio: Más Barato</SelectItem>
            <SelectItem value="city_asc">Ciudad (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Imagen</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Dirección</TableHead>
              <TableHead className="hidden sm:table-cell">Ciudad</TableHead>
              <TableHead className="hidden lg:table-cell">Operación</TableHead>
              <TableHead className="w-[160px]">Estado</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedProperties.map((property) => {
              const isAdmin = currentUserRole === "admin";
              const isOwner = property.agent_id === currentUserId;
              const canEdit = isAdmin || isOwner;
              const mainImage = property.property_images?.[0]?.image_url;
              const hasPrice =
                typeof property.price === "number" && property.price > 0;
              const formattedPrice = hasPrice
                ? new Intl.NumberFormat("es-AR", { style: "decimal" }).format(
                    property.price as number
                  )
                : "N/A";

              const currentColorClass =
                statusColors[property.status || ""] ||
                "bg-gray-100 text-gray-800";

              return (
                <TableRow key={property.id}>
                  <TableCell>
                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-zinc-100">
                      <Image
                        src={
                          mainImage ||
                          "https://placehold.co/100x100/e0e0e0/a1a1a1?text=Sin+Foto"
                        }
                        alt={property.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </TableCell>

                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/propiedades/editar/${property.id}`}
                      className="hover:underline text-zinc-900"
                    >
                      {property.title}
                    </Link>
                  </TableCell>

                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {property.street_address || "-"}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {property.city || "-"}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell capitalize text-muted-foreground text-sm">
                    {property.operation_type}
                  </TableCell>

                  <TableCell>
                    <Select
                      defaultValue={property.status}
                      onValueChange={(val) =>
                        handleStatusChange(property.id, val)
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger
                        className={`h-8 w-full text-xs font-semibold border-0 ring-0 focus:ring-0 shadow-none ${currentColorClass}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(statusLabels).map((statusKey) => (
                          <SelectItem key={statusKey} value={statusKey}>
                            {statusLabels[statusKey]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="font-semibold text-sm">
                    {hasPrice
                      ? `${property.currency} $${formattedPrice}`
                      : "Consultar"}
                  </TableCell>

                  <TableCell>
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>

                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/propiedades/editar/${property.id}`}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => setPropertyToDelete(property)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash className="mr-2 h-4 w-4" /> Borrar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center opacity-20">
                        <Shield className="w-4 h-4" />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!propertyToDelete}
        onOpenChange={() => setPropertyToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la propiedad y sus imágenes de forma
              permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Sí, eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
