import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClientServer } from "@/lib/supabase";
import { googleAuthUrl, googleCalendarEnabled } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gcal_oauth_state";

// Inicio del OAuth: exige sesión, guarda un state aleatorio en cookie
// httpOnly (anti-CSRF) y redirige al consentimiento de Google. `next` es
// la ruta del panel a la que volver al terminar.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!googleCalendarEnabled) {
    return NextResponse.redirect(`${origin}/dashboard/perfil?google=disabled`);
  }

  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const nextParam = request.nextUrl.searchParams.get("next") ?? "/dashboard/perfil";
  const next = nextParam.startsWith("/dashboard") ? nextParam : "/dashboard/perfil";
  const state = randomBytes(24).toString("base64url");

  const response = NextResponse.redirect(googleAuthUrl(origin, state));
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google-calendar",
    maxAge: 600,
  });
  return response;
}
