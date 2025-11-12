"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClientBrowser } from "@/lib/supabase-browser";
import type { PropertyWithDetails } from "@/app/types/entities";
import { toast } from "sonner";
import { MoreHorizontal, Edit, Trash, ArrowUpDown } from "lucide-react";

// Importaciones de Shadcn
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
import { Badge } from "@/shared/components/ui/badge";
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

// Props que recibe el componente
type PropertyTableProps = {
  initialProperties: PropertyWithDetails[];
};

export function PropertyTable({ initialProperties }: PropertyTableProps) {
  const supabase = createClientBrowser();

  // Estado local para manejar la lista y el diálogo de borrado
  const [properties, setProperties] = useState(initialProperties);
  const [isDeleting, setIsDeleting] = useState(false);
  const [propertyToDelete, setPropertyToDelete] =
    useState<PropertyWithDetails | null>(null);
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");

  const statusColors: { [key: string]: string } = {
    EN_VENTA: "bg-emerald-500 hover:bg-emerald-600 text-white",
    EN_ALQUILER: "bg-sky-500 hover:bg-sky-600 text-white",
    RESERVADO: "bg-amber-500 hover:bg-amber-600 text-black",
    VENDIDO: "bg-zinc-700 hover:bg-zinc-800 text-white",
    ALQUILADO: "bg-purple-600 hover:bg-purple-700 text-white",
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

    // 1. Filtrar
    const filtered = properties.filter(
      (prop) =>
        prop.title?.toLowerCase().includes(lowerFilter) ||
        prop.street_address?.toLowerCase().includes(lowerFilter) ||
        prop.city?.toLowerCase().includes(lowerFilter)
    );

    // 2. Ordenar
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

  // --- Lógica de Borrado ---
  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;

    setIsDeleting(true);
    const toastId = toast.loading("Eliminando propiedad y sus imágenes...");

    // 1. Borrar imágenes del Storage (¡Importante!)
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
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-[220px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
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

      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Imagen</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Dirección</TableHead>
              <TableHead className="hidden sm:table-cell">Ciudad</TableHead>
              <TableHead className="hidden lg:table-cell">Operación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead className="w-[50px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedProperties.map((property) => {
              const mainImage = property.property_images?.[0]?.image_url;

              // --- Formateo de precio ---
              const hasPrice =
                typeof property.price === "number" && property.price > 0;
              const formattedPrice = hasPrice
                ? new Intl.NumberFormat("es-AR", { style: "decimal" }).format(
                    property.price as number
                  )
                : "N/A";
              return (
                <TableRow key={property.id}>
                  <TableCell>
                    <Image
                      src={
                        mainImage ||
                        "https://placehold.co/100x100/e0e0e0/a1a1a1?text=Sin+Foto"
                      }
                      alt={property.title}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                      unoptimized
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/propiedades/editar/${property.id}`}
                      className="hover:underline"
                    >
                      {property.title}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {property.street_address || "Sin dirección"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {property.city || "N/A"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell capitalize text-muted-foreground">
                    {property.operation_type}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-white text-sm ${
                        statusColors[property.status || ""] || "bg-zinc-500"
                      }`}
                    >
                      {statusLabels[property.status || ""] ||
                        property.status ||
                        "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {hasPrice
                      ? `${property.currency} $${formattedPrice}`
                      : "Consultar"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/propiedades/editar/${property.id}`}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setPropertyToDelete(property)}
                          className="text-red-500"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Borrar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              la propiedad y todas sus imágenes asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
