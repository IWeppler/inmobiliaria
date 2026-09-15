import { createClientServer } from "@/lib/supabase";
import { AddAmenityForm } from "@/features/dashboard/amenities/AmenityForm";
import { ExchangeRateManager } from "@/features/dashboard/settings/ExchangeRate";
import { AddPropertyTypeForm } from "@/features/dashboard/property/PropertyTypeForm";
import {
  AssignmentRules,
  type AssignmentRule,
} from "@/features/dashboard/settings/AssignmentRules";
import { Integrations } from "@/features/dashboard/settings/Integrations";
import { IndexValues, type IndexValueRow } from "@/features/dashboard/settings/IndexValues";
import { whatsappEnabled } from "@/lib/whatsapp";
import { aiAgentEnabled } from "@/features/whatsapp/agent";

export default async function DashboardPage() {
  const supabase = await createClientServer();

  const [
    { data: rate },
    { data: rules },
    { data: agents },
    { data: cityRows },
    { data: typeRows },
    { data: indexRows },
  ] = await Promise.all([
    supabase.from("exchange_rates").select("usd_to_ars").eq("id", 1).single(),
    supabase
      .from("lead_assignment_rules")
      .select("id, agent_id, match_type, match_value, priority, agents(full_name)")
      .order("match_type")
      .order("priority")
      .order("match_value"),
    supabase.from("agents").select("id, full_name").order("full_name"),
    supabase.from("properties").select("city").not("city", "is", null),
    supabase.from("property_types").select("name").order("name"),
    supabase.from("index_values").select("id, index_code, period, value").order("period", { ascending: false }),
  ]);

  const currentRate = rate?.usd_to_ars || 1500;
  const cities = Array.from(
    new Set((cityRows ?? []).map((r) => r.city!).filter(Boolean))
  ).sort();
  const propertyTypes = (typeRows ?? [])
    .map((t) => t.name)
    .filter((n): n is string => !!n);

  return (
    <div className="theme-tn flex min-h-screen items-start justify-center">
      <main className="w-full max-w-5xl p-4 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <AddPropertyTypeForm />
          <AddAmenityForm />
        </div>
        <div>
          <ExchangeRateManager currentRate={currentRate} />
        </div>
        <div>
          <AssignmentRules
            initialRules={(rules ?? []) as unknown as AssignmentRule[]}
            agents={agents ?? []}
            cities={cities}
            propertyTypes={propertyTypes}
          />
        </div>
        <div>
          <IndexValues initial={(indexRows ?? []) as IndexValueRow[]} />
        </div>
        <div>
          <Integrations
            whatsappEnabled={whatsappEnabled}
            aiAgentEnabled={aiAgentEnabled}
          />
        </div>
      </main>
    </div>
  );
}
