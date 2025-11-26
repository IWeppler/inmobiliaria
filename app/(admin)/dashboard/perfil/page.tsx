import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/features/dashboard/profile/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClientServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!agent) {
    return <div>Error cargando perfil.</div>;
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 w-5xl mx-auto">
        <div>
            <h1 className="text-3xl font-clash font-semibold">Mi Perfil</h1>
            <p className="text-muted-foreground">Gestiona tu información personal y de contacto.</p>
        </div>
        
        <ProfileForm agent={agent} />
      </main>
    </div>
  );
}