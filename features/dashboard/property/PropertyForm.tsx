"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Search,
  Trash2,
  MapPin,
  ImagePlus,
  Check,
  X,
  Circle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Form,
  FormControl,
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
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  PROPERTY_STATUSES,
  propertyStatusMeta,
  formatPrice,
} from "@/features/dashboard/property/propertyStatus";
import type { GeocodeCandidate } from "@/app/api/geocode/route";

const LocationPicker = dynamic(
  () => import("@/features/dashboard/property/LocationPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full animate-pulse items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  },
);

// --- Tipos ---
type PropertyType = { id: number; name: string };
type Amenity = { id: number; name: string };
type Agent = { id: string; full_name: string | null };
type ExistingImage = { id: string; image_url: string };

// --- Schema ---
export const propertySchema = z.object({
  title: z.string().min(5, { message: "El título es muy corto." }),
  description: z.string().optional(),
  street_address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(3, "La ciudad es muy corta."),
  province: z.string().min(3, "La provincia es muy corta."),
  latitude: z.coerce.number().nullable(),
  longitude: z.coerce.number().nullable(),
  agent_id: z.string().optional().nullable(),
  property_type_id: z.coerce.number().min(1, { message: "Elegí un tipo." }),
  price: z.coerce.number().min(0, { message: "El precio no puede ser negativo." }),
  expensas: z.coerce.number().min(0).optional().nullable(),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(0),
  rooms: z.coerce.number().int().min(0),
  total_area: z.coerce.number().min(1, { message: "Indicá la superficie total." }),
  covered_area: z.coerce.number().min(0),
  cocheras: z.string().optional().nullable(),
  antiguedad: z.string().optional().nullable(),
  currency: z.string(),
  operation_type: z.string(),
  amenities: z.array(z.number()).optional(),
  status: z.enum(["EN_VENTA", "EN_ALQUILER", "RESERVADO", "VENDIDO", "ALQUILADO"]),
});

export type PropertyFormValues = z.output<typeof propertySchema>;

type PropertyFormProps = {
  initialData?: PropertyFormValues & {
    id: string;
    property_images: ExistingImage[];
  };
  propertyTypes: PropertyType[];
};

const FIELD_LABELS: Partial<Record<keyof PropertyFormValues, string>> = {
  title: "Título",
  city: "Ciudad",
  province: "Provincia",
  property_type_id: "Tipo de propiedad",
  price: "Precio",
  total_area: "Superficie total",
  covered_area: "Superficie cubierta",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  rooms: "Ambientes",
};

const DEFAULT_CENTER: [number, number] = [-29.2333, -61.7667];

// --- UI helpers ---
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
    </section>
  );
}

// Input numérico con unidad a la derecha (m², ARS…).
function UnitInput({
  unit,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="relative">
      <Input type="number" inputMode="decimal" className={cn("pr-12", className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

const chipClass = (on: boolean) =>
  cn(
    "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors",
    on ? "border-primary bg-primary/5 text-foreground" : "border-border text-fg-secondary hover:bg-muted/50",
  );

const thumbButtonClass =
  "absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-sm bg-card/95 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100";

export function PropertyForm({ initialData, propertyTypes: initialTypes }: PropertyFormProps) {
  const router = useRouter();
  const supabase = createClientBrowser();
  const isEditMode = !!initialData;

  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>(initialTypes);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(initialData?.property_images || []);
  const [dragOver, setDragOver] = useState(false);

  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodeCandidates, setGeocodeCandidates] = useState<GeocodeCandidate[]>([]);
  const [mapZoom, setMapZoom] = useState(13);
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(
    initialData?.latitude && initialData?.longitude
      ? [initialData.latitude, initialData.longitude]
      : null,
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    initialData?.latitude && initialData?.longitude
      ? [initialData.latitude, initialData.longitude]
      : DEFAULT_CENTER,
  );

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema) as unknown as Resolver<PropertyFormValues>,
    defaultValues: initialData
      ? {
          ...initialData,
          neighborhood: initialData.neighborhood || "",
          description: initialData.description || "",
          street_address: initialData.street_address || "",
          agent_id: initialData.agent_id || null,
          rooms: initialData.rooms ?? 0,
          expensas: initialData.expensas ?? null,
          cocheras: initialData.cocheras ?? "",
          antiguedad: initialData.antiguedad ?? "",
          amenities: initialData.amenities ?? [],
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
          agent_id: null,
          property_type_id: 0,
          price: 0,
          expensas: null,
          total_area: 0,
          covered_area: 0,
          rooms: 0,
          bedrooms: 0,
          bathrooms: 0,
          cocheras: "",
          antiguedad: "",
          operation_type: "venta",
          status: "EN_VENTA",
          currency: "USD",
          amenities: [],
        },
  });

  // Previews de archivos nuevos (object URLs liberadas al cambiar).
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // Aviso al salir con cambios sin guardar.
  const dirty = form.formState.isDirty || files.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Catálogos
  useEffect(() => {
    const load = async () => {
      const [{ data: types }, { data: agentsData }, { data: amenities }] = await Promise.all([
        supabase.from("property_types").select("id, name").order("name"),
        supabase.from("agents").select("id, full_name").order("full_name"),
        supabase.from("amenities").select("id, name").order("name"),
      ]);
      if (types) setPropertyTypes(types);
      if (agentsData) setAgents(agentsData);
      if (amenities) setAllAmenities(amenities);
    };
    load();
  }, [supabase]);

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      form.setValue("latitude", lat, { shouldDirty: true });
      form.setValue("longitude", lng, { shouldDirty: true });
      setSelectedPoint([lat, lng]);
    },
    [form],
  );

  // --- Geocoding (E2.3) ---
  const applyCandidate = (c: GeocodeCandidate) => {
    setMapCenter([c.lat, c.lon]);
    setMapZoom(c.precision === "street" ? 16 : c.precision === "locality" ? 13 : 9);
    setGeocodeCandidates([]);
    if (c.precision === "street") {
      handleLocationSelect(c.lat, c.lon);
      toast.success("Ubicación marcada. Arrastrá el marcador si hace falta.");
    } else {
      toast.info("Mapa centrado en la zona. Hacé click para marcar el punto exacto.");
    }
  };

  const handleGeocode = async () => {
    const { street_address, city, province } = form.getValues();
    if (!city || !province) {
      toast.error("Ingresá al menos ciudad y provincia para buscar en el mapa.");
      return;
    }
    setGeocodingLoading(true);
    try {
      const params = new URLSearchParams({ street: street_address ?? "", city, province });
      const response = await fetch(`/api/geocode?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      const { candidates } = (await response.json()) as { candidates: GeocodeCandidate[] };
      if (candidates.length === 0) {
        toast.error("No se encontró la zona. Probá con menos detalle o marcá a mano.");
      } else if (candidates.length === 1) {
        applyCandidate(candidates[0]);
      } else {
        setGeocodeCandidates(candidates);
      }
    } catch {
      toast.error("Error de conexión con el servicio de mapas.");
    } finally {
      setGeocodingLoading(false);
    }
  };

  // --- Fotos ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setFiles((prev) => [...prev, ...incoming]);
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleDeleteImage = async (image: ExistingImage) => {
    const toastId = toast.loading("Eliminando foto…");
    const path = image.image_url.split("/properties/").pop();
    if (path) await supabase.storage.from("properties").remove([path]);
    await supabase.from("property_images").delete().eq("id", image.id);
    setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    toast.success("Foto eliminada.", { id: toastId });
  };

  // --- Submit ---
  const onInvalid = (errors: Record<string, unknown>) => {
    const keys = Object.keys(errors);
    const names = keys.map((k) => FIELD_LABELS[k as keyof PropertyFormValues] ?? k).slice(0, 4);
    toast.error(`Revisá: ${names.join(", ")}${keys.length > 4 ? "…" : ""}`);
  };

  const onSubmit = async (data: PropertyFormValues) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("No estás autenticado.");
      return;
    }
    if (!data.latitude || !data.longitude) {
      toast.error("Marcá la ubicación en el mapa.");
      document.getElementById("ubicacion")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const toastId = toast.loading(isEditMode ? "Guardando cambios…" : "Creando propiedad…");
    const { amenities, ...propertyData } = data;
    const payload = {
      ...propertyData,
      cocheras: propertyData.cocheras || null,
      antiguedad: propertyData.antiguedad || null,
      expensas: propertyData.expensas ?? null,
    };

    // Fotos nuevas
    const newImagePaths: string[] = [];
    for (const file of files) {
      const filePath = `${user.id}/${uuidv4()}-${file.name}`;
      const { data: up, error } = await supabase.storage.from("properties").upload(filePath, file);
      if (error) {
        toast.error(`No se pudo subir ${file.name}: ${error.message}`, { id: toastId });
        continue;
      }
      newImagePaths.push(supabase.storage.from("properties").getPublicUrl(up.path).data.publicUrl);
    }

    let propertyId = initialData?.id;
    if (isEditMode && initialData) {
      const { error } = await supabase.from("properties").update(payload).eq("id", initialData.id);
      if (error) {
        toast.error(error.message, { id: toastId });
        return;
      }
    } else {
      const { data: created, error } = await supabase
        .from("properties")
        .insert({ ...payload, agent_id: payload.agent_id || user.id })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message, { id: toastId });
        return;
      }
      propertyId = created.id;
    }

    if (propertyId) {
      await supabase.from("property_amenities").delete().eq("property_id", propertyId);
      if (amenities && amenities.length > 0) {
        await supabase
          .from("property_amenities")
          .insert(amenities.map((id) => ({ property_id: propertyId!, amenity_id: id })));
      }
      if (newImagePaths.length > 0) {
        await supabase.from("property_images").insert(
          newImagePaths.map((url, index) => ({
            property_id: propertyId!,
            image_url: url,
            order: existingImages.length + index,
          })),
        );
      }
    }

    toast.success(isEditMode ? "Cambios guardados." : "Propiedad creada.", { id: toastId });
    form.reset(data);
    setFiles([]);
    router.push(`/dashboard/propiedades/${propertyId}`);
    router.refresh();
  };

  // --- Resumen / checklist (en vivo) ---
  const w = form.watch();
  const cover = existingImages[0]?.image_url ?? previews[0] ?? null;
  const photoCount = existingImages.length + files.length;
  const meta = propertyStatusMeta(w.status);
  const typeName = propertyTypes.find((t) => t.id === Number(w.property_type_id))?.name;
  const checklist = [
    { label: "Título", ok: (w.title ?? "").length >= 5 },
    { label: "Tipo y operación", ok: Number(w.property_type_id) > 0 },
    { label: "Precio", ok: Number(w.price) > 0, hint: Number(w.price) > 0 ? undefined : "0 = a consultar" },
    { label: "Ubicación en el mapa", ok: !!w.latitude && !!w.longitude },
    { label: "Superficie", ok: Number(w.total_area) > 0 },
    { label: "Fotos", ok: photoCount > 0, hint: photoCount > 0 && photoCount < 3 ? "mejor con 3 o más" : undefined },
    { label: "Descripción", ok: (w.description ?? "").trim().length > 40 },
  ];
  const done = checklist.filter((c) => c.ok).length;
  const submitting = form.formState.isSubmitting;
  const cancelHref = initialData ? `/dashboard/propiedades/${initialData.id}` : "/dashboard/propiedades";

  const actions = (
    <>
      <Button asChild variant="outline" type="button">
        <Link href={cancelHref}>Cancelar</Link>
      </Button>
      <Button type="submit" form="property-form" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <Check />}
        {isEditMode ? "Guardar cambios" : "Crear propiedad"}
      </Button>
    </>
  );

  return (
    <Form {...form}>
      <form id="property-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="contents">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ===================== COLUMNA PRINCIPAL ===================== */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* 1. Lo básico */}
            <Section id="basico" title="Lo básico" description="Cómo se va a llamar y qué es.">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título de la publicación</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej.: Casa 3 dormitorios con pileta en Fisherton" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="property_type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Elegí un tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypes.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="operation_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operación</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROPERTY_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              <span className="flex items-center gap-2">
                                <s.icon className="size-3.5" style={{ color: s.color }} />
                                {s.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsable</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={isEditMode ? "Sin asignar" : "Vos"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.full_name ?? a.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            {/* 2. Precio */}
            <Section id="precio" title="Precio">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px_1fr]">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Precio <span className="font-normal text-muted-foreground">(0 = a consultar)</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="ARS">ARS</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expensas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Expensas <span className="font-normal text-muted-foreground">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <UnitInput
                          unit="ARS"
                          min={0}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            {/* 3. Características */}
            <Section id="caracteristicas" title="Características">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["rooms", "Ambientes"],
                    ["bedrooms", "Dormitorios"],
                    ["bathrooms", "Baños"],
                  ] as const
                ).map(([name, label]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input type="number" inputMode="numeric" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name="total_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sup. total</FormLabel>
                      <FormControl><UnitInput unit="m²" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="covered_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sup. cubierta</FormLabel>
                      <FormControl><UnitInput unit="m²" min={0} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cocheras"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cocheras</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej.: 1 cubierta" {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="antiguedad"
                render={({ field }) => (
                  <FormItem className="sm:max-w-xs">
                    <FormLabel>Antigüedad</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej.: A estrenar · 10 años" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {allAmenities.length > 0 && (
                <FormField
                  control={form.control}
                  name="amenities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Amenities{" "}
                        {field.value && field.value.length > 0 && (
                          <span className="font-normal text-muted-foreground">· {field.value.length}</span>
                        )}
                      </FormLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {allAmenities.map((a) => {
                          const on = field.value?.includes(a.id) ?? false;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                field.onChange(
                                  on
                                    ? (field.value ?? []).filter((id) => id !== a.id)
                                    : [...(field.value ?? []), a.id],
                                )
                              }
                              className={chipClass(on)}
                            >
                              {on && <Check className="size-3" />}
                              {a.name}
                            </button>
                          );
                        })}
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </Section>

            {/* 4. Descripción */}
            <Section id="descripcion" title="Descripción" description="Lo que ve el interesado en la ficha pública y en los portales.">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        rows={8}
                        placeholder="Distribución, estado, orientación, servicios, entorno, forma de pago…"
                        className="min-h-40 resize-y"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {(field.value ?? "").length} caracteres
                    </p>
                  </FormItem>
                )}
              />
            </Section>

            {/* 5. Ubicación */}
            <Section
              id="ubicacion"
              title="Ubicación"
              description="Buscá la dirección y ajustá el punto en el mapa. El punto es obligatorio."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad / localidad</FormLabel>
                      <FormControl><Input placeholder="Ej.: Rosario" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="street_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección o referencia</FormLabel>
                      <FormControl><Input placeholder="Ej.: Belgrano 830 · Ruta 95 Km 10" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barrio / paraje</FormLabel>
                      <FormControl><Input placeholder="Ej.: Fisherton" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={handleGeocode} disabled={geocodingLoading}>
                  {geocodingLoading ? <Loader2 className="animate-spin" /> : <Search />}
                  Buscar en el mapa
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedPoint ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="size-3.5" /> Punto marcado
                    </span>
                  ) : (
                    "Después de buscar, hacé click en el mapa para marcar el punto exacto."
                  )}
                </span>
              </div>

              {geocodeCandidates.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border bg-card text-sm">
                  {geocodeCandidates.map((c) => (
                    <li key={`${c.lat},${c.lon}`}>
                      <button
                        type="button"
                        onClick={() => applyCandidate(c)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50"
                      >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1">{c.label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {c.precision === "street" ? "calle" : c.precision === "locality" ? "localidad" : "zona"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="overflow-hidden rounded-lg border border-border">
                <LocationPicker
                  initialLat={initialData?.latitude || undefined}
                  initialLng={initialData?.longitude || undefined}
                  cityCoordinates={mapCenter}
                  zoom={mapZoom}
                  selected={selectedPoint}
                  onLocationSelect={handleLocationSelect}
                />
              </div>
            </Section>

            {/* 6. Fotos */}
            <Section
              id="fotos"
              title="Fotos"
              description="La primera es la portada. Arrastrá archivos o hacé click para elegir."
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border-strong bg-sunken hover:bg-muted",
                )}
              >
                <ImagePlus className="size-5 text-muted-foreground" />
                <span className="text-fg-secondary">Soltá las fotos acá o hacé click</span>
                <span className="text-xs text-muted-foreground">JPG o PNG · varias a la vez</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {(existingImages.length > 0 || files.length > 0) && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {existingImages.map((img, i) => (
                    <li key={img.id} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                      <Image src={img.image_url} alt="" fill sizes="160px" className="object-cover" unoptimized />
                      {i === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-sm bg-card/95 px-1.5 text-[11px] font-medium text-foreground">
                          Portada
                        </span>
                      )}
                      <button type="button" aria-label="Eliminar foto" onClick={() => handleDeleteImage(img)} className={thumbButtonClass}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previews[i]} alt="" className="h-full w-full object-cover" />
                      {existingImages.length === 0 && i === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-sm bg-card/95 px-1.5 text-[11px] font-medium text-foreground">
                          Portada
                        </span>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                        Nueva
                      </span>
                      <button type="button" aria-label="Quitar" onClick={() => removeFile(i)} className={thumbButtonClass}>
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* ===================== RESUMEN (sticky) ===================== */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[68px]">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-[16/10] bg-muted">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin portada</div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {w.title?.trim() || <span className="text-muted-foreground">Sin título</span>}
                  </p>
                  <StatusBadge tone={meta.tone} color={meta.color} icon={meta.icon} className="shrink-0">
                    {meta.label}
                  </StatusBadge>
                </div>
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {formatPrice(Number(w.price), w.currency) ?? "A consultar"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[typeName, w.operation_type === "alquiler" ? "Alquiler" : "Venta"].filter(Boolean).join(" · ")}
                  {(w.street_address || w.city) && ` · ${[w.street_address, w.city].filter(Boolean).join(", ")}`}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Completitud</h3>
                <span className="text-xs text-muted-foreground">{done} de {checklist.length}</span>
              </div>
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${(done / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="flex flex-col gap-1">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-border-strong" />
                    )}
                    <span className={c.ok ? "text-fg-secondary" : "text-foreground"}>{c.label}</span>
                    {c.hint && <span className="text-xs text-muted-foreground">· {c.hint}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden items-center justify-end gap-2 lg:flex">{actions}</div>
          </aside>
        </div>

        {/* Barra de acciones fija en mobile */}
        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 lg:hidden">
          {actions}
        </div>
      </form>
    </Form>
  );
}
