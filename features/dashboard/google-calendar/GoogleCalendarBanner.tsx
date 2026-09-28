import { cookies } from "next/headers";
import { createClientServer } from "@/lib/supabase";
import {
  GCAL_BANNER_COOKIE,
  getGoogleConnection,
  googleCalendarEnabled,
} from "@/lib/google-calendar";
import { GoogleCalendarBannerView } from "@/features/dashboard/google-calendar/GoogleCalendarBannerView";

// Aviso bajo el topbar del panel para quien todavía no conectó Google
// Calendar (o cuya conexión falló). Se oculta 30 días al cerrarlo
// (cookie) y desaparece solo al conectar. Sin credenciales de Google en
// el deployment no se muestra.
export async function GoogleCalendarBanner() {
  if (!googleCalendarEnabled) return null;
  const store = await cookies();
  if (store.get(GCAL_BANNER_COOKIE)) return null;

  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const connection = await getGoogleConnection(user.id);
  if (connection && !connection.last_error) return null;

  return <GoogleCalendarBannerView needsReconnect={Boolean(connection?.last_error)} />;
}
