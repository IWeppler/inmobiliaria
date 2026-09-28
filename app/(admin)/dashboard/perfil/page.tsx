import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { ProfileForm } from "@/features/dashboard/profile/ProfileForm";
import { Suspense } from "react";
import { GoogleCalendarCard } from "@/features/dashboard/google-calendar/GoogleCalendarCard";
import { getGoogleConnection, googleCalendarEnabled } from "@/lib/google-calendar";

export default async function ProfilePage() {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!agent) {
    return <div className="p-8">Error cargando perfil.</div>;
  }

  const googleConnection = googleCalendarEnabled ? await getGoogleConnection(user.id) : null;

  return (
    <Page width="narrow">
      <PageHeader
        title="Mi perfil"
        description="Información personal y de contacto."
      />
      <ProfileForm agent={agent} />
      <Suspense>
        <GoogleCalendarCard enabled={googleCalendarEnabled} connection={googleConnection} />
      </Suspense>
    </Page>
  );
}
