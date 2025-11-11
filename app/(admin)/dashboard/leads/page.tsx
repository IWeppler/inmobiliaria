import { createClientServer } from "@/lib/supabase";
import { LeadTable } from "@/features/dashboard/LeadTable";
import { LeadWithDetails } from "@/app/types";


export default async function LeadsPage() {
  const supabase = await createClientServer(); // Con el await corregido

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div>No autorizado</div>;

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      `
      *,
      properties ( title )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return <p>Error al cargar los leads: {error.message}</p>;
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {/* ❌ El header y el botón se mueven a LeadTable.tsx */}
        
        {/* Pasamos los datos al componente cliente */}
        <LeadTable initialLeads={leads as LeadWithDetails[]} />
      </main>
    </div>
  );
}
