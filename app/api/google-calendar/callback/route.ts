import { NextResponse, type NextRequest } from "next/server";
import { createClientServer } from "@/lib/supabase";
import { backfillAgentEvents, connectGoogleCalendar } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gcal_oauth_state";

// Vuelta del consentimiento de Google: valida state, canjea el code por
// tokens, guarda la conexión del agente logueado y sube sus eventos
// futuros. Siempre vuelve al panel con ?google=<resultado>.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}
  const next = saved.next?.startsWith("/dashboard") ? saved.next : "/dashboard/perfil";

  const back = (result: string) => {
    const url = new URL(next, origin);
    url.searchParams.set("google", result);
    const response = NextResponse.redirect(url);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/google-calendar" });
    return response;
  };

  if (params.get("error")) return back("cancelled");
  const code = params.get("code");
  if (!code || !saved.state || params.get("state") !== saved.state) return back("error");

  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    await connectGoogleCalendar(user.id, code, origin);
  } catch (e) {
    console.error("Google Calendar connect failed:", e);
    return back("error");
  }

  await backfillAgentEvents(user.id).catch((e) =>
    console.error("Google Calendar backfill failed:", e),
  );
  return back("connected");
}
