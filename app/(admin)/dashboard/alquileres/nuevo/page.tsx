import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { Button } from "@/shared/components/ui/button";
import { ContractForm } from "@/features/rentals/ContractForm";

export default async function NuevoContratoPage() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: properties }, { data: contacts }] = await Promise.all([
    // Cualquier propiedad de alquiler (aunque ya figure ALQUILADO, por si
    // se carga un contrato vigente que no estaba en el sistema).
    supabase
      .from("properties")
      .select("id, title, status")
      .ilike("operation_type", "alquiler")
      .order("title"),
    supabase.from("rental_contacts").select("id, full_name, kind").order("full_name"),
  ]);

  const opts = (contacts ?? []) as { id: string; full_name: string; kind: string }[];

  return (
    <div className="theme-tn flex flex-col w-full max-w-5xl mx-auto px-4 py-6 gap-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/dashboard/alquileres">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-[26px] font-serif font-semibold tracking-tight text-foreground">
            Nuevo contrato
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Se generan las cuotas mensuales automáticamente y la propiedad pasa a Alquilada.
          </p>
        </div>
      </div>
      <ContractForm
        properties={((properties ?? []) as { id: string; title: string; status: string }[]).map(
          (p) => ({
            id: p.id,
            label: `${p.title}${p.status === "ALQUILADO" ? " (alquilada)" : ""}`,
          })
        )}
        owners={opts.filter((c) => c.kind === "owner").map((c) => ({ id: c.id, label: c.full_name }))}
        tenants={opts.filter((c) => c.kind === "tenant").map((c) => ({ id: c.id, label: c.full_name }))}
      />
    </div>
  );
}
