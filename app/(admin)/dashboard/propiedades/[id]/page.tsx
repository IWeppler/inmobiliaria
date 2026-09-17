import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, FileText, Instagram, MoreHorizontal, Pencil } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { ActivityList, type ActivityItem } from "@/shared/components/ActivityList";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  propertyStatusMeta,
  operationLabel,
  formatPrice,
} from "@/features/dashboard/property/propertyStatus";
import { statusMeta } from "@/features/dashboard/leads/leadStatus";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE, formatDate, money } from "@/features/rentals/logic";
import { PROPERTY_STATUSES } from "@/features/dashboard/property/propertyStatus";

export const metadata: Metadata = { title: "Propiedad" };

// Detalle de propiedad: la entidad como centro. Desde acá se salta a los
// leads interesados, al contrato vigente y a la edición. La actividad se
// arma con leads creados, visitas (events) y cambios de estado
// (status_history), sin tabla nueva.
export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase
    .from("properties")
    .select(
      "*, property_types(name), property_images(image_url), agents(full_name)",
    )
    .eq("id", id)
    .single();
  if (!property) notFound();

  const [{ data: leads }, { data: events }, { data: history }, { data: contracts }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, name, status, source, created_at")
        .eq("property_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("id, title, date, time, type, lead_id, created_at")
        .eq("property_id", id)
        .order("date", { ascending: false }),
      supabase
        .from("status_history")
        .select("id, status, changed_at")
        .eq("entity_type", "property")
        .eq("entity_id", id)
        .order("changed_at", { ascending: false }),
      supabase
        .from("rental_contracts")
        .select("id, status, start_date, end_date, rent_amount, currency, tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name)")
        .eq("property_id", id)
        .order("start_date", { ascending: false }),
    ]);

  const meta = propertyStatusMeta(property.status);
  const price = formatPrice(property.price, property.currency);
  const images = ((property.property_images ?? []) as { image_url: string | null }[])
    .map((i) => i.image_url)
    .filter((u): u is string => !!u);
  const location = [property.street_address, property.neighborhood, property.city]
    .filter(Boolean)
    .join(" · ");
  const statusLabel = (s: string) =>
    PROPERTY_STATUSES.find((x) => x.value === s)?.label ?? s;

  const activity: ActivityItem[] = [
    ...(leads ?? []).map((l) => ({
      id: `lead-${l.id}`,
      at: l.created_at,
      text: `${l.name} consultó`,
      meta: l.source ? l.source.toLowerCase().replaceAll("_", " ") : undefined,
      href: `/dashboard/leads/${l.id}`,
    })),
    ...(events ?? []).map((e) => ({
      id: `event-${e.id}`,
      at: e.created_at,
      text: e.type === "visita" ? `Visita agendada: ${e.title}` : e.title,
      meta: `${formatDate(e.date)} ${e.time}`,
      href: e.lead_id ? `/dashboard/leads/${e.lead_id}` : undefined,
    })),
    ...(history ?? []).map((h) => ({
      id: `status-${h.id}`,
      at: h.changed_at,
      text: `Pasó a ${statusLabel(h.status)}`,
    })),
    {
      id: "created",
      at: property.created_at,
      text: "Propiedad publicada",
    },
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Tipo", value: property.property_types?.name },
    { label: "Operación", value: operationLabel(property.operation_type) },
    { label: "Precio", value: price ?? "A consultar" },
    { label: "Expensas", value: property.expensas ? money(property.expensas, "ARS") : null },
    { label: "Superficie total", value: property.total_area ? `${property.total_area} m²` : null },
    { label: "Superficie cubierta", value: property.covered_area ? `${property.covered_area} m²` : null },
    { label: "Ambientes", value: property.rooms },
    { label: "Dormitorios", value: property.bedrooms },
    { label: "Baños", value: property.bathrooms },
    { label: "Cocheras", value: property.cocheras },
    { label: "Antigüedad", value: property.antiguedad },
    { label: "Provincia", value: property.province },
    { label: "Responsable", value: property.agents?.full_name },
    { label: "Vistas en el sitio", value: property.views_count ?? 0 },
    { label: "Publicada", value: formatDate(property.created_at) },
  ].filter((d) => d.value !== null && d.value !== undefined && d.value !== "");

  const activeContract = (contracts ?? []).find((c) => c.status === "ACTIVO") ?? contracts?.[0];

  return (
    <Page>
      <PageHeader
        backHref="/dashboard/propiedades"
        title={property.title}
        aside={
          <StatusBadge tone={meta.tone} color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusBadge>
        }
        description={
          <>
            {location || "Sin dirección"}
            {price && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{price}</span>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/propiedades/editar/${property.id}`}>
                <Pencil /> Editar
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/propiedades/${property.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Ver en el sitio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/propiedades/pdf/${property.id}`} target="_blank" rel="noopener noreferrer">
                    <FileText /> Ficha PDF
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/propiedades/instagram/${property.id}`}>
                    <Instagram /> Pieza Instagram
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Columna principal */}
        <div className="flex min-w-0 flex-col gap-6">
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <div className="relative col-span-4 aspect-[16/9] overflow-hidden rounded-lg bg-muted sm:col-span-3">
                <Image src={images[0]} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" unoptimized />
              </div>
              <div className="hidden grid-rows-3 gap-2 sm:grid">
                {images.slice(1, 4).map((src) => (
                  <div key={src} className="relative overflow-hidden rounded-md bg-muted">
                    <Image src={src} alt="" fill sizes="15vw" className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Detalle</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {details.map((d) => (
                  <div
                    key={d.label}
                    className="flex h-9 items-center justify-between gap-4 border-b border-border-subtle text-sm last:border-0 sm:[&:nth-last-child(2)]:border-0"
                  >
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd className="truncate text-right font-medium text-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {property.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-fg-secondary">{property.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna lateral: relaciones */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Leads
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">{leads?.length ?? 0}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!leads || leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nadie consultó por esta propiedad todavía.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {leads.slice(0, 8).map((l) => {
                    const m = statusMeta(l.status);
                    return (
                      <li key={l.id} className="flex h-9 items-center justify-between gap-3 text-sm">
                        <Link href={`/dashboard/leads/${l.id}`} className="truncate font-medium text-foreground underline-offset-4 hover:underline">
                          {l.name}
                        </Link>
                        <StatusBadge tone={m.tone} icon={m.icon}>{m.label}</StatusBadge>
                      </li>
                    );
                  })}
                  {leads.length > 8 && (
                    <li className="pt-2 text-xs text-muted-foreground">+{leads.length - 8} más</li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              {!activeContract ? (
                <p className="text-sm text-muted-foreground">
                  Sin contrato.{" "}
                  {property.operation_type?.toLowerCase() === "alquiler" && (
                    <Link href="/dashboard/alquileres/nuevo" className="text-primary underline-offset-4 hover:underline">
                      Crear uno
                    </Link>
                  )}
                </p>
              ) : (
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/dashboard/alquileres/${activeContract.id}`} className="truncate font-medium text-foreground underline-offset-4 hover:underline">
                      {(activeContract.tenant as unknown as { full_name: string } | null)?.full_name ?? "Contrato"}
                    </Link>
                    <StatusBadge tone={CONTRACT_STATUS_TONE[activeContract.status] ?? "neutral"}>
                      {CONTRACT_STATUS_LABELS[activeContract.status] ?? activeContract.status}
                    </StatusBadge>
                  </div>
                  <span className="text-muted-foreground">
                    {money(activeContract.rent_amount, activeContract.currency)} · {formatDate(activeContract.start_date)} → {formatDate(activeContract.end_date)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={activity} limit={12} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
