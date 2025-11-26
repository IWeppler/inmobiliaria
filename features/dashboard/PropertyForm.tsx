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
import dynamic from "next/dynamic";

// Importaciones de Shadcn
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
import { Loader2, Search, Trash2, MapPin } from "lucide-react";
import Image from "next/image";

// Importación dinámica del mapa
const LocationPicker = dynamic(
  () => import("@/features/dashboard/LocationPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full bg-zinc-100 animate-pulse rounded-lg flex items-center justify-center text-zinc-400">
        Cargando Mapa...
      </div>
    ),
  }
);

// --- Tipos ---
type PropertyType = {
  id: number;
  name: string;
};

type Amenity = {
  id: number;
  name: string;
};

// Tipo para el Agente
type Agent = {
  id: string;
  full_name: string | null;
};

// --- SCHEMA ZOD ACTUALIZADO ---
export const propertySchema = z.object({
  title: z.string().min(5, { message: "El título es muy corto." }),
  description: z.string().optional(),
  street_address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(3, "La ciudad es muy corta."),
  province: z.string().min(3, "La provincia es muy corta."),
  latitude: z.coerce.number().nullable(),
  longitude: z.coerce.number().nullable(),

  // CORRECCIÓN 1: Agregamos agent_id al esquema
  agent_id: z.string().optional().nullable(),

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
  const [agents, setAgents] = useState<Agent[]>([]); // Estado para agentes
  const [files, setFiles] = useState<File[] | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);

  const [existingImages, setExistingImages] = useState(
    initialData?.property_images || []
  );

  const [mapCenter, setMapCenter] = useState<[number, number]>(
    initialData?.latitude && initialData?.longitude
      ? [initialData.latitude, initialData.longitude]
      : [-29.2333, -61.7667]
  );

  const isEditMode = !!initialData;

  const mainForm = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema) as unknown as Resolver<PropertyForm>,
    defaultValues: initialData
      ? {
          ...initialData,
          neighborhood: initialData.neighborhood || "",
          description: initialData.description || "",
          street_address: initialData.street_address || "",
          // Aseguramos que agent_id venga del initialData
          agent_id: initialData.agent_id || null,
        }
      : {
          title: "",
          description: "",
          street_address: "",
          neighborhood: "",
          city: "",
          province: "Santa Fe",
          latitude: null,
          longitude: null,
          agent_id: null, // Default null
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

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      mainForm.setValue("latitude", lat);
      mainForm.setValue("longitude", lng);
    },
    [mainForm]
  );

  // --- Carga de Datos (Tipos y Agentes) ---
  useEffect(() => {
    const loadData = async () => {
      // 1. Tipos de Propiedad
      const { data: types } = await supabase
        .from("property_types")
        .select("id, name")
        .order("name", { ascending: true });
      if (types) setPropertyTypes(types);

      // 2. Agentes (CORRECCIÓN: Carga real de datos)
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, full_name")
        .order("full_name", { ascending: true });
      if (agentsData) setAgents(agentsData);
    };

    const checkUserAndLoad = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.push("/login");
      await loadData();
    };

    checkUserAndLoad();
  }, [supabase, router]);

  // Carga de Amenities
  useEffect(() => {
    const fetchAmenities = async () => {
      const { data } = await supabase
        .from("amenities")
        .select("id, name")
        .order("name", { ascending: true });
      if (data) setAllAmenities(data);
    };
    fetchAmenities();
  }, [supabase]);

  // --- Geocoding ---
  const handleGeocode = async () => {
    setGeocodingLoading(true);
    const { street_address, city, province } = mainForm.getValues();

    if (!city || !province) {
      toast.error(
        "Ingresa al menos Ciudad y Provincia para buscar en el mapa."
      );
      setGeocodingLoading(false);
      return;
    }

    const addressQuery = street_address ? `${street_address}, ` : "";
    const query = encodeURIComponent(`${addressQuery}${city}, ${province}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setMapCenter([lat, lon]);

        if (street_address) {
          mainForm.setValue("latitude", lat);
          mainForm.setValue("longitude", lon);
          toast.success("Mapa centrado y ubicación marcada.");
        } else {
          toast.info("Mapa centrado en la ciudad. Haz click para marcar.");
        }
      } else {
        toast.error("No se encontró la zona.");
      }
    } catch (error) {
      console.log(error);
      toast.error("Error de conexión con el servicio de mapas.");
    }
    setGeocodingLoading(false);
  };

  const handleDeleteImage = async (image: ExistingImage) => {
    const toastId = toast.loading("Eliminando imagen...");
    const path = image.image_url.split("/properties/").pop();
    if (path) await supabase.storage.from("properties").remove([path]);
    await supabase.from("property_images").delete().eq("id", image.id);
    setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    toast.success("Imagen eliminada.", { id: toastId });
  };

  // --- Submit ---
  const onSubmitProperty = async (data: PropertyForm) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Error: No estás autenticado.");
      return;
    }

    if (!data.latitude || !data.longitude) {
      toast.error("Por favor, marca la ubicación en el mapa.");
      return;
    }

    const toastId = isEditMode ? "update" : "create";
    toast.loading(isEditMode ? "Actualizando..." : "Creando...", {
      id: toastId,
    });

    const { amenities, ...propertyData } = data;

    // Subida de Imágenes
    const newImagePaths: { path: string; publicUrl: string }[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const filePath = `${user.id}/${uuidv4()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("properties")
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Error imagen: ${uploadError.message}`, { id: toastId });
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

    // Insert / Update Propiedad
    let propertyId = initialData?.id;

    if (isEditMode && initialData) {
      // UPDATE
      const { error } = await supabase
        .from("properties")
        .update(propertyData) // Aquí ya viaja el agent_id seleccionado
        .eq("id", initialData.id);

      if (error) {
        toast.error(error.message, { id: toastId });
        return;
      }
    } else {
      // INSERT
      // CORRECCIÓN LÓGICA:
      // Si el usuario seleccionó un agente en el form (propertyData.agent_id), usamos ese.
      // Si NO seleccionó nada (es null), usamos el ID del usuario logueado como fallback (user.id).
      const finalAgentId = propertyData.agent_id
        ? propertyData.agent_id
        : user.id;

      const { data: newProperty, error } = await supabase
        .from("properties")
        .insert({
          ...propertyData,
          agent_id: finalAgentId,
        })
        .select()
        .single();

      if (error) {
        toast.error(error.message, { id: toastId });
        return;
      }
      propertyId = newProperty.id;
    }

    // Amenities
    if (propertyId) {
      await supabase
        .from("property_amenities")
        .delete()
        .eq("property_id", propertyId);
      if (amenities && amenities.length > 0) {
        const newLinks = amenities.map((id) => ({
          property_id: propertyId,
          amenity_id: id,
        }));
        await supabase.from("property_amenities").insert(newLinks);
      }
    }

    // Imágenes
    if (propertyId && newImagePaths.length > 0) {
      const imagesToInsert = newImagePaths.map((img, index) => ({
        property_id: propertyId!,
        image_url: img.publicUrl,
        order: existingImages.length + index,
      }));
      await supabase.from("property_images").insert(imagesToInsert);
    }

    toast.success("¡Listo!", { id: toastId });
    if (!isEditMode) {
      mainForm.reset();
      setFiles(null);
      setMapCenter([-29.2333, -61.7667]);
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-clash font-semibold text-xl">
          {isEditMode ? "Editar Propiedad" : "Cargar Nueva Propiedad"}
        </CardTitle>
        <CardDescription>
          Completa los datos. Usa el mapa para ubicar campos o lotes.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...mainForm}>
          <form
            onSubmit={mainForm.handleSubmit(onSubmitProperty)}
            className="space-y-8"
          >
            {/* 1. Datos Básicos */}
            <div className="space-y-4">
              <FormField
                control={mainForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Publicación</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Campo 500 Has..." {...field} />
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
                    <FormLabel>Descripción Completa</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalles..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 2. UBICACIÓN Y MAPA */}
            <div className="space-y-4 p-4 border rounded-md bg-zinc-50/50">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-clash font-semibold text-xl">
                  Ubicación & Mapa
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={mainForm.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia</FormLabel>
                      <FormControl>
                        <Input placeholder="Santa Fe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad / Localidad</FormLabel>
                      <FormControl>
                        <Input placeholder="Tostado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={mainForm.control}
                  name="street_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección / Referencia</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Ruta 95 Km 10" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mainForm.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barrio / Paraje</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Paraje El Tigre" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="button"
                variant="default"
                onClick={handleGeocode}
                disabled={geocodingLoading}
              >
                {geocodingLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar Zona en Mapa
              </Button>

              <div className="space-y-2 pt-2">
                <FormLabel className="text-base font-medium text-black">
                  Marca el punto exacto en el mapa:
                </FormLabel>
                <div className="border-2 border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                  <LocationPicker
                    initialLat={initialData?.latitude || undefined}
                    initialLng={initialData?.longitude || undefined}
                    cityCoordinates={mapCenter}
                    onLocationSelect={handleLocationSelect}
                  />
                </div>
              </div>
            </div>

            {/* 3. Detalles y Operación */}
            <div className="space-y-4 p-4 border rounded-md bg-zinc-50/50">
              <h3 className="font-clash font-semibold text-xl">Detalles</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            <SelectValue placeholder="Tipo..." />
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

                {/* SELECT DE AGENTE RESPONSABLE */}
                <FormField
                  control={mainForm.control}
                  name="agent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agente Responsable</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || undefined}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar agente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              {/* Operación y Estado */}
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

              {/* Precios y Medidas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={mainForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                  control={mainForm.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dorm.</FormLabel>
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
                  name="total_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total (m²)</FormLabel>
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
                      <FormLabel>Cub. (m²)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-4 p-4 border rounded-md bg-zinc-50/50">
              <FormLabel className="font-clash font-semibold text-xl">
                Amenities
              </FormLabel>
              <FormField
                control={mainForm.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {allAmenities.map((amenity) => (
                        <FormItem
                          key={amenity.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(amenity.id)}
                              onCheckedChange={(checked) => {
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
                          <FormLabel className="font-normal cursor-pointer">
                            {amenity.name}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Imágenes */}
            <div className="space-y-4 p-4 border rounded-md bg-zinc-50/50">
              <h3 className="font-clash font-semibold text-xl">Imágenes</h3>
              {/* Galería Existente */}
              {isEditMode && existingImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {existingImages.map((image) => (
                    <div key={image.id} className="relative w-24 h-24 group">
                      <Image
                        src={image.image_url}
                        alt="propiedad"
                        fill
                        className="rounded-md object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteImage(image)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* Input Nueva Imagen */}
              <FormItem>
                <FormLabel>Subir Nuevas</FormLabel>
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
              </FormItem>
              {/* Preview */}
              {files && files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((file, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        fill
                        className="rounded-md object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={mainForm.formState.isSubmitting}
              className="w-full text-lg py-6 bg-foreground hover:bg-foreground/90"
            >
              {mainForm.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
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
