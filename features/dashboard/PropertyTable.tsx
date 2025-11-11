"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClientBrowser } from "@/lib/supabase-browser";
import type { PropertyWithDetails } from "@/app/types/entities";
import { toast } from "sonner";
import { MoreHorizontal, Edit, Trash } from "lucide-react";

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

    // 2. Borrar registros de 'property_images' (si RLS lo permite)
    // 3. Borrar la propiedad de 'properties'
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
      // router.refresh();
    }
    setPropertyToDelete(null);
  };

  return (
    <>
      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Imagen</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Dirección</TableHead>
              <TableHead className="hidden lg:table-cell">Operación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead className="w-[50px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => {
              const mainImage = property.property_images?.[0]?.image_url;
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
                    {/* El título es clickeable para ver/editar */}
                    <Link
                      href={`/dashboard/propiedades/editar/${property.id}`} // Futura ruta de edición
                      className="hover:underline"
                    >
                      {property.title}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {property.street_address || "Sin dirección"}
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
                    {property.currency} ${property.price}
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

      {/* --- Diálogo de Confirmación de Borrado --- */}
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
