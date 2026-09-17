import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { ProfileForm } from "@/features/dashboard/profile/ProfileForm";

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

  return (
    <Page width="narrow">
      <PageHeader
        title="Mi perfil"
        description="Información personal y de contacto."
      />
      <ProfileForm agent={agent} />
    </Page>
  );
}
