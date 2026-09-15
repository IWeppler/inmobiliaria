import { createClientServer } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { InstagramPieceClient } from "@/features/social/InstagramPieceClient";

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
    .select("id, title")
    .eq("id", id)
    .single();
  if (!property) notFound();

  return <InstagramPieceClient propertyId={property.id} title={property.title} />;
}
