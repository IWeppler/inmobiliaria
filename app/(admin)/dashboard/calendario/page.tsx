import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { Page } from "@/shared/components/PageShell";
import { CalendarPage } from "@/features/dashboard/calendar/CalendarPage";

export const metadata = { title: "Calendario" };

export default async function CalendarRoute() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <Page><CalendarPage /></Page>;
}
