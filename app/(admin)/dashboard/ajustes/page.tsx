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
import { RentalAlertSettings } from "@/features/dashboard/settings/RentalAlertSettings";
import { RentalNoticeSettings } from "@/features/dashboard/settings/RentalNoticeSettings";
import { getRentalAlertSettings } from "@/features/rentals/settings";
import { whatsappEnabled } from "@/lib/whatsapp";
import { googleCalendarEnabled } from "@/lib/google-calendar";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Page, PageHeader } from "@/shared/components/PageShell";

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
    supabase.from("index_values").select("id, index_code, period, value, source, updated_at").order("period", { ascending: false }),
  ]);

  // Quién del equipo conectó Google Calendar. La tabla es solo
  // service_role; se lee con admin únicamente si quien mira es admin.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("agents").select("role").eq("id", user.id).single()
    : { data: null };
  const { data: googleRows } =
    googleCalendarEnabled && me?.role === "admin"
      ? await supabaseAdmin.from("google_calendar_connections").select("agent_id")
      : { data: null };
  const googleConnected = new Set((googleRows ?? []).map((r) => r.agent_id));
  const { data: noticeSettings } = await supabase.from("rental_settings")
    .select("notify_receipts, notify_adjustments, notify_due, notify_overdue, adjustment_notice_days, due_reminder_days, overdue_reminder_days")
    .eq("id", 1).maybeSingle();

  const currentRate = rate?.usd_to_ars || 1500;
  const cities = Array.from(
    new Set((cityRows ?? []).map((r) => r.city!).filter(Boolean))
  ).sort();
  const propertyTypes = (typeRows ?? [])
    .map((t) => t.name)
    .filter((n): n is string => !!n);

  return (
    <Page width="narrow">
      <PageHeader
        title="Ajustes"
        description="Catálogos, tasa de cambio, reglas de asignación e integraciones."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddPropertyTypeForm />
        <AddAmenityForm />
      </div>
      <ExchangeRateManager currentRate={currentRate} />
      <AssignmentRules
        initialRules={(rules ?? []) as unknown as AssignmentRule[]}
        agents={agents ?? []}
        cities={cities}
        propertyTypes={propertyTypes}
      />
      <IndexValues initial={(indexRows ?? []) as IndexValueRow[]} />
      <RentalAlertSettings initial={await getRentalAlertSettings(supabase)} />
      {noticeSettings && <RentalNoticeSettings initial={noticeSettings} whatsappConfigured={whatsappEnabled} />}
      <Integrations
        whatsappEnabled={whatsappEnabled}
        googleCalendar={{
          enabled: googleCalendarEnabled,
          agents: (agents ?? []).map((a) => ({
            name: a.full_name ?? "Sin nombre",
            connected: googleConnected.has(a.id),
          })),
        }}
      />
    </Page>
  );
}
