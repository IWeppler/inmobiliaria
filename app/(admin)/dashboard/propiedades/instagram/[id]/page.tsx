import { createClientServer } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { InstagramPieceClient } from "@/features/social/InstagramPieceClient";

export const metadata: Metadata = { title: "Pieza para Instagram" };

// E2.2: pieza para Instagram desde la ficha de propiedad.
export default async function InstagramPiecePage({
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
    .select("id, title, description, street_address, neighborhood, city, province, operation_type, agent_id, property_images(image_url, order)")
    .eq("id", id)
    .single();
  if (!property) notFound();

  const [{ data: agent }, { data: currentAgent }] = await Promise.all([
    property.agent_id
      ? supabase.from("agents").select("phone").eq("id", property.agent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("agents").select("phone").eq("id", user.id).maybeSingle(),
  ]);

  const images = [...(property.property_images ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((i) => i.image_url)
    .filter((u): u is string => !!u);

  return (
    <InstagramPieceClient
      propertyId={property.id}
      title={property.title}
      images={images}
      description={property.description ?? ""}
      location={[property.street_address, property.neighborhood, property.city, property.province].filter(Boolean).join(", ")}
      phone={agent?.phone || currentAgent?.phone || ""}
      operation={property.operation_type?.toLowerCase() === "alquiler" ? "alquiler" : "venta"}
    />
  );
}
