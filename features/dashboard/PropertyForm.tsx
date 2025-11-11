"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

// Importaciones de Shadcn (asumidas)
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Loader2, Search, Trash2 } from "lucide-react";
import Image from "next/image";

// --- Tipos y Schemas ---
type PropertyType = {
  id: number;
  name: string;
};

type Amenity = {
  id: number;
  name: string;
};

// El mismo schema de Zod
export const propertySchema = z.object({
  title: z.string().min(5, { message: "El título es muy corto." }),
  description: z.string().optional(),
  street_address: z.string().min(5, "La dirección es muy corta."),
  neighborhood: z.string().optional(),
  city: z.string().min(3, "La ciudad es muy corta."),
  province: z.string().min(3, "La provincia es muy corta."),
  latitude: z.coerce.number().nullable(),
  longitude: z.coerce.number().nullable(),
  property_type_id: z.coerce
    .number()
    .min(1, { message: "Debes seleccionar un tipo." }),
  price: z.coerce.number().min(1, { message: "El precio debe ser mayor a 0." }),
  expensas: z.coerce.number().optional().nullable(),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0),
  rooms: z.coerce.number().int().min(0),
  total_area: z.coerce.number().min(1),
  covered_area: z.coerce.number().min(0),
  currency: z.string(),
  operation_type: z.string(),
  amenities: z.array(z.number()).optional(),
  status: z.enum([
    "EN_VENTA",
    "EN_ALQUILER",
    "RESERVADO",
    "VENDIDO",
    "ALQUILADO",
  ]),
});

type PropertyForm = z.output<typeof propertySchema>;

type ExistingImage = {
  id: string;
  image_url: string;
};

type PropertyFormProps = {
  initialData?: PropertyForm & { id: string; property_images: ExistingImage[] };
  propertyTypes: PropertyType[];
};

export function PropertyForm({ initialData }: PropertyFormProps) {
  const router = useRouter();
  const supabase = createClientBrowser();
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [files, setFiles] = useState<File[] | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [existingImages, setExistingImages] = useState(
    initialData?.property_images || []
  );

  // Determinamos si estamos en modo "Edición"
  const isEditMode = !!initialData;

  // --- Formulario Principal ---
  const mainForm = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema) as unknown as Resolver<PropertyForm>,
    defaultValues: initialData
      ? {
          ...initialData,
          neighborhood: initialData.neighborhood || "",
          description: initialData.description || "",
        }
      : {
          title: "",
          description: "",
          street_address: "",
          neighborhood: "",
          city: "",
          province: "",
          latitude: null,
          longitude: null,
          property_type_id: 0,
          price: 0,
          total_area: 0,
          covered_area: 0,
          operation_type: "venta",
          status: "EN_VENTA",
          currency: "USD",
          bedrooms: 1,
          bathrooms: 1,
        },
  });

  // --- Lógica de Carga de Datos ---
  const fetchPropertyTypes = useCallback(async () => {
    const { data: types } = await supabase
      .from("property_types")
      .select("id, name")
      .order("name", { ascending: true });
    if (types) setPropertyTypes(types);
  }, [supabase]);

  useEffect(() => {
    // Gatekeeper y carga inicial
    const checkUserAndLoadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.push("/login");
      await fetchPropertyTypes();
    };
    checkUserAndLoadData();
  }, [supabase, router, fetchPropertyTypes]);

  useEffect(() => {
    const fetchAmenities = async () => {
      const { data } = await supabase
        .from("amenities")
        .select("id, name")
        .order("name", { ascending: true });
      if (data) {
        setAllAmenities(data);
      }
    };
    fetchAmenities();
  }, [supabase]);

  // --- Lógica de Geocodificación (Idéntica) ---
  const handleGeocode = async () => {
    setGeocodingLoading(true);
    const { street_address, city, province } = mainForm.getValues();
    if (!street_address || !city || !province) {
      toast.error("Por favor, completa dirección, ciudad y provincia.");
      setGeocodingLoading(false);
      return;
    }
    const query = encodeURIComponent(`${street_address}, ${city}, ${province}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mainForm.setValue("latitude", parseFloat(lat));
        mainForm.setValue("longitude", parseFloat(lon));
        toast.success("¡Coordenadas encontradas!");
      } else {
        toast.error("No se encontraron coordenadas para esa dirección.");
        mainForm.setValue("latitude", null);
        mainForm.setValue("longitude", null);
      }
    } catch (error) {
      console.log(error);
      toast.error("Error al buscar coordenadas.");
    }
    setGeocodingLoading(false);
  };

  const handleDeleteImage = async (image: ExistingImage) => {
    const toastId = toast.loading("Eliminando imagen...");

    // 1. Borrar del Storage
    const path = image.image_url.split("/properties/").pop();
    if (path) {
      await supabase.storage.from("properties").remove([path]);
    }

    // 2. Borrar de la tabla 'property_images'
    await supabase.from("property_images").delete().eq("id", image.id);

    // 3. Actualizar el estado local
    setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    toast.success("Imagen eliminada.", { id: toastId });
  };

  // --- Lógica de Submit Principal  ---
  const onSubmitProperty = async (data: PropertyForm) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Error: No estás autenticado.");
      return;
    }

    // ID para los toasts
    const toastId = isEditMode ? "update" : "create";
    toast.loading(
      isEditMode ? "Actualizando propiedad..." : "Creando propiedad...",
      { id: toastId }
    );

    const { amenities, ...propertyData } = data;

    // --- 1. Subir NUEVAS Imágenes ---
    const newImagePaths: { path: string; publicUrl: string }[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const filePath = `${user.id}/${uuidv4()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("properties")
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Error subiendo imagen: ${uploadError.message}`, {
            id: toastId,
          });
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("properties")
          .getPublicUrl(uploadData.path);

        newImagePaths.push({
          path: uploadData.path,
          publicUrl: publicUrlData.publicUrl,
        });
      }
    }

    // --- 2. Insertar o Actualizar la Propiedad ---
    let propertyId = initialData?.id;

    if (isEditMode && initialData) {
      // --- MODO UPDATE ---
      const { error: updateError } = await supabase
        .from("properties")
        // 👇 CAMBIO 2: Usar 'propertyData' en lugar de 'data'
        .update(propertyData)
        .eq("id", initialData.id);

      if (updateError) {
        toast.error(
          `Error al actualizar la propiedad: ${updateError.message}`,
          { id: toastId }
        );
        return;
      }
    } else {
      // --- MODO INSERT (Crear) ---
      const { data: newProperty, error: insertError } = await supabase
        .from("properties")
        // 👇 CAMBIO 2: Usar 'propertyData' en lugar de 'data'
        .insert({ ...propertyData, agent_id: user.id })
        .select()
        .single();

      if (insertError) {
        toast.error(`Error al crear la propiedad: ${insertError.message}`, {
          id: toastId,
        });
        return;
      }
      propertyId = newProperty.id;
    }

    // --- 👇 CAMBIO 3: Sincronizar Amenities ---
    // Esta lógica va DESPUÉS de guardar la propiedad y ANTES del éxito
    if (propertyId) {
      // 3.1. Borrar todos los amenities ANTIGUOS de esta propiedad
      const { error: deleteError } = await supabase
        .from("property_amenities")
        .delete()
        .eq("property_id", propertyId);

      if (deleteError) {
        toast.error(`Error al actualizar amenities: ${deleteError.message}`, {
          id: toastId,
        });
        return; // Detener si no podemos borrar los antiguos
      }

      // 3.2. Insertar los amenities NUEVOS (si hay alguno seleccionado)
      if (amenities && amenities.length > 0) {
        const newAmenityLinks = amenities.map((amenityId) => ({
          property_id: propertyId,
          amenity_id: amenityId,
        }));

        const { error: insertError } = await supabase
          .from("property_amenities")
          .insert(newAmenityLinks);

        if (insertError) {
          toast.error(`Error al guardar amenities: ${insertError.message}`, {
            id: toastId,
          });
          return;
        }
      }
    }
    // --- Fin Cambio 3 ---

    // --- 4. Insertar Imágenes en la tabla (Tu lógica original - Sin cambios) ---
    if (propertyId && newImagePaths.length > 0) {
      const imagesToInsert = newImagePaths.map((img, index) => ({
        property_id: propertyId!,
        image_url: img.publicUrl,
        order: existingImages.length + index,
      }));

      await supabase.from("property_images").insert(imagesToInsert);
    }

    // --- 5. Éxito (Tu lógica original - Sin cambios) ---
    toast.success(
      isEditMode ? "¡Propiedad actualizada!" : "¡Propiedad creada!",
      { id: toastId }
    );
    if (!isEditMode) {
      mainForm.reset();
      setFiles(null);
    }
    router.push("/dashboard");
    router.refresh();
  };

  // --- Renderizado (JSX con Shadcn) ---
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Editar Propiedad" : "Cargar Nueva Propiedad"}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? "Modifica los campos de la propiedad."
            : "Completa todos los campos para añadir una nueva propiedad."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...mainForm}>
          <form
            onSubmit={mainForm.handleSubmit(onSubmitProperty)}
            className="space-y-8"
          >
            {/* Titulo y descripcion del inmueble */}
            <div className="space-y-4">
              <FormField
                control={mainForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Espectacular 3 ambientes..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={mainForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalles de la propiedad..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* --- Sección Dirección y Geocodificación --- */}
            <div className="space-y-4 p-4 border rounded-md">
              <h3 className="text-lg font-medium">Ubicación</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={mainForm.control}
                  name="street_address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Dirección (Calle y Nro)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Av. Corrientes 1234"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barrio (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Centro" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad</FormLabel>
                      <FormControl>
                        <Input placeholder="Tostado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia</FormLabel>
                      <FormControl>
                        <Input placeholder="Santa Fé" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleGeocode}
                disabled={geocodingLoading}
              >
                {geocodingLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar Coordenadas
              </Button>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={mainForm.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitud</FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          placeholder="(auto)"
                          {...field}
                          value={String(field.value ?? "")}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitud</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={Number(field.value ?? 0)}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* --- Sección Tipo, Operación y Estado --- */}
            <div className="space-y-4 p-4 border rounded-md">
              <h3 className="text-lg font-medium">Detalles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={mainForm.control}
                  name="property_type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Propiedad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypes.map((type) => (
                            <SelectItem key={type.id} value={String(type.id)}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="operation_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operación</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="venta">Venta</SelectItem>
                          <SelectItem value="alquiler">Alquiler</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EN_VENTA">En Venta</SelectItem>
                          <SelectItem value="EN_ALQUILER">
                            En Alquiler
                          </SelectItem>
                          <SelectItem value="RESERVADO">Reservado</SelectItem>
                          <SelectItem value="VENDIDO">Vendido</SelectItem>
                          <SelectItem value="ALQUILADO">Alquilado</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {/* --- Sección Precio y Moneda --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={mainForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio $</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="expensas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expensas (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ej: 50000"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="ARS">ARS</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {/* --- Sección Detalles (Habitaciones, M2) --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={mainForm.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dormitorios</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Baños</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="rooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ambientes</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={
                          field.value ? String(field.value) : undefined
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la cantidad de ambientes" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">N/A</SelectItem>
                          <SelectItem value="1">Monoambiente</SelectItem>
                          <SelectItem value="2">2 ambientes</SelectItem>
                          <SelectItem value="3">3 ambientes</SelectItem>
                          <SelectItem value="4">4 ambientes</SelectItem>
                          <SelectItem value="5">5 o más ambientes</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={mainForm.control}
                  name="total_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área Total (m²)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="covered_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área Cubierta (m²)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sección Amenities */}
            <div className="space-y-4 p-4 border rounded-md">
              <FormField
                control={mainForm.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-lg font-medium">
                        Amenities
                      </FormLabel>
                      <FormDescription>
                        Selecciona todos los amenities que apliquen.
                      </FormDescription>
                    </div>
                    {/* Renderizamos una grilla de checkboxes.
                  'field.value' es el array de IDs seleccionados (ej: [1, 5, 10])
                */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {allAmenities.map((amenity) => (
                        <FormItem
                          key={amenity.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              // Comprueba si el ID de este amenity está en el array del formulario
                              checked={field.value?.includes(amenity.id)}
                              onCheckedChange={(checked) => {
                                // Lógica para añadir/quitar el ID del array
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      amenity.id,
                                    ])
                                  : field.onChange(
                                      (field.value || []).filter(
                                        (id) => id !== amenity.id
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {amenity.name}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* --- Sección Carga de Imágenes --- */}
            <div className="space-y-4 p-4 border rounded-md">
              <h3 className="text-lg font-medium">Imágenes</h3>

              {/* 1. Galería de Imágenes Existentes (Solo en modo Editar) */}
              {isEditMode && existingImages.length > 0 && (
                <div className="mb-4">
                  <FormLabel>Imágenes Actuales</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {existingImages.map((image) => (
                      <div key={image.id} className="relative w-24 h-24">
                        <Image
                          src={image.image_url}
                          alt="Imagen existente"
                          fill
                          style={{ objectFit: "cover" }}
                          className="rounded-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10"
                          onClick={() => handleDeleteImage(image)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Input para Nuevas Imágenes */}
              <FormItem>
                <FormLabel>
                  {isEditMode
                    ? "Añadir más imágenes"
                    : "Imágenes de la Propiedad"}
                </FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) =>
                      setFiles(
                        e.target.files ? Array.from(e.target.files) : null
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Puedes seleccionar múltiples imágenes.
                </FormDescription>
              </FormItem>

              {/* 3. Vista previa de imágenes NUEVAS */}
              {files && files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((file, i) => (
                    <div key={i} className="relative w-24 h-24">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt="Vista previa"
                        fill
                        style={{ objectFit: "cover" }}
                        className="rounded-md"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- Botón de Submit --- */}
            <Button
              type="submit"
              disabled={mainForm.formState.isSubmitting}
              className="w-full text-lg py-6"
            >
              {mainForm.formState.isSubmitting ? (
                isEditMode ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  "Actualizando..."
                )
              ) : isEditMode ? (
                "Guardar Cambios"
              ) : (
                "Crear Propiedad"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
