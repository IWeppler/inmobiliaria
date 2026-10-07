import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { isPipelineStage, listingAlerts } from "@/features/dashboard/listings/listing";
import { ListingsBoard, type Prospect } from "@/features/dashboard/listings/ListingsBoard";

// /dashboard/captaciones: propietarios que quieren vender o alquilar, del
// primer contacto a la propiedad publicada. RLS: el agente ve las suyas.
export default async function CaptacionesPage({ searchParams }: { searchParams: Promise<{ nueva?: string; c?: string }> }) {
  const { nueva, c } = await searchParams;
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = ymdInAppTz();
  const since = addDays(today, -90);
  const [{ data: me }, { data }, { data: types }, { data: properties }] = await Promise.all([
    supabase.from("agents").select("role").eq("id", user.id).single(),
    supabase.from("owner_prospects")
      .select("*, agent:agents(full_name), property:properties(id, title)")
      .order("created_at", { ascending: false }),
    supabase.from("property_types").select("id, name").order("name"),
    supabase.from("properties").select("id, title").in("status", ["EN_VENTA", "EN_ALQUILER", "RESERVADO"])
      .order("created_at", { ascending: false }).limit(300),
  ]);

  const prospects = ((data ?? []) as unknown as Prospect[])
    .filter((p) => isPipelineStage(p.stage) || p.stage_changed_at.slice(0, 10) >= since);
  const active = prospects.filter((p) => isPipelineStage(p.stage));
  const attention = active.filter((p) => listingAlerts(p, today).some((a) => a.urgency !== "baja")).length;
  const published = prospects.filter((p) => p.stage === "PUBLICADA").length;
  const lost = prospects.filter((p) => p.stage === "PERDIDA").length;
  const exclusive = active.filter((p) => p.stage === "AUTORIZACION" && p.exclusive).length;

  return (
    <Page>
      <PageHeader title="Captaciones" description="Propietarios en camino a publicar: tasación, propuesta y autorización." />
      <StatStrip>
        <Stat label="En curso" value={active.length} tone={attention ? "warning" : undefined}
          detail={attention ? `${attention} necesitan atención` : "Todas al día"} />
        <Stat label="Con autorización" value={active.filter((p) => p.stage === "AUTORIZACION").length}
          detail={exclusive ? `${exclusive} exclusivas` : "Listas para publicar"} />
        <Stat label="Publicadas (90 días)" value={published} />
        <Stat label="Conversión (90 días)" value={published + lost ? `${Math.round((published / (published + lost)) * 100)} %` : "-"}
          detail={lost ? `${lost} perdidas` : undefined} />
      </StatStrip>
      <ListingsBoard prospects={prospects} today={today} showAgent={me?.role === "admin"} initialCreateOpen={nueva === "1"} initialSelectedId={c ?? null}
        propertyTypes={(types ?? []).map((t) => ({ id: t.id, name: t.name }))}
        properties={(properties ?? []).map((p) => ({ id: p.id, name: p.title }))} />
    </Page>
  );
}
