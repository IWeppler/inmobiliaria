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
    .select("id, title, property_images(image_url, order)")
    .eq("id", id)
    .single();
  if (!property) notFound();

  const images = [...(property.property_images ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((i) => i.image_url)
    .filter((u): u is string => !!u);

  return (
    <InstagramPieceClient
      propertyId={property.id}
      title={property.title}
      images={images}
    />
  );
}
