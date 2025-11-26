import { createClientServer } from "@/lib/supabase";
import { AddAmenityForm } from "@/features/dashboard/AmenityForm";
import { ExchangeRateManager } from "@/features/dashboard/ExchangeRate";
import { AddPropertyTypeForm } from "@/features/dashboard/PropertyTypeForm";

export default async function DashboardPage() {
  const supabase = await createClientServer();

  const { data: rate } = await supabase
    .from("exchange_rates")
    .select("usd_to_ars")
    .eq("id", 1)
    .single();

  const currentRate = rate?.usd_to_ars || 1500;

  return (
    <div className="flex min-h-screen items-start justify-center">
      <main className="w-full max-w-5xl p-4 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <AddPropertyTypeForm />
          <AddAmenityForm />
        </div>
        <div>
          <ExchangeRateManager currentRate={currentRate} />
        </div>
      </main>
    </div>
  );
}