import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
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
    <div className="flex min-h-screen w-full flex-col bg-muted/10">
      <main className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 w-full max-w-5xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-clash font-semibold text-foreground">
            Mi Perfil
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona tu información personal y de contacto.
          </p>
        </div>

        <ProfileForm agent={agent} />
      </main>
    </div>
  );
}
