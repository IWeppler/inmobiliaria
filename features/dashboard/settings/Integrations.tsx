import { Rss, MessageCircle, CalendarCheck, CalendarSync } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { BRAND } from "@/lib/brand";

// Tier 3: estado y URLs de las integraciones. Solo lectura -- la
// configuración real vive en variables de entorno del deployment.
type GoogleCalendarStatus = {
  enabled: boolean;
  agents: { name: string; connected: boolean }[];
};

export function Integrations({
  whatsappEnabled,
  googleCalendar,
}: {
  whatsappEnabled: boolean;
  googleCalendar: GoogleCalendarStatus;
}) {
  const connected = googleCalendar.agents.filter((a) => a.connected);
  const pending = googleCalendar.agents.filter((a) => !a.connected);
  const rows: {
    icon: typeof Rss;
    title: string;
    description: string;
    value: string;
    extra?: string;
    status: string;
    team?: GoogleCalendarStatus["agents"];
  }[] = [
    {
      icon: Rss,
      title: "Feed para portales (Zonaprop / Argenprop / otros)",
      description:
        "Pasale esta URL al portal en su alta de integración XML. Se actualiza sola cada hora con las propiedades activas.",
      value: `${BRAND.siteUrl}/feed/propiedades.xml`,
      extra: `${BRAND.siteUrl}/feed/propiedades.json`,
      status: "Activo",
    },
    {
      icon: CalendarCheck,
      title: "Booking page pública",
      description:
        "Cada propiedad tiene su página para que el interesado agende la visita solo. Lun a sáb, 09 a 18 hs, según la agenda del asesor.",
      value: `${BRAND.siteUrl}/agendar/<id-de-propiedad>`,
      status: "Activo",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Business",
      description: whatsappEnabled
        ? "Conectado. Confirmaciones de visita por plantilla y mensajes entrantes como notas del lead."
        : "No configurado. Requiere WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_VERIFY_TOKEN en el deployment, y el webhook apuntando a la URL de abajo.",
      value: `${BRAND.siteUrl}/api/whatsapp/webhook`,
      status: whatsappEnabled ? "Conectado" : "Pendiente",
    },
    {
      icon: CalendarSync,
      title: "Google Calendar",
      description: googleCalendar.enabled
        ? `Cada integrante conecta su cuenta desde Mi perfil y sus eventos se copian a su calendario. ${connected.length} de ${googleCalendar.agents.length} conectados${pending.length ? "; al resto se le muestra un aviso en el panel." : "."}`
        : "No configurado. Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el deployment (cliente OAuth web de Google Cloud con la API de Calendar habilitada) y esta URL de redirección autorizada:",
      value: `${BRAND.siteUrl}/api/google-calendar/callback`,
      status: googleCalendar.enabled ? (pending.length ? "Parcial" : "Conectado") : "Pendiente",
      team: googleCalendar.enabled ? googleCalendar.agents : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integraciones</CardTitle>
        <CardDescription>
          Portales, agenda pública, WhatsApp y Google Calendar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.title} className="py-4 first:pt-0 last:pb-0 flex gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{r.title}</p>
                  <StatusBadge
                    tone={r.status === "Pendiente" ? "warning" : r.status === "Parcial" ? "neutral" : "success"}
                  >
                    {r.status}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                <code className="block mt-2 text-xs bg-secondary rounded px-2 py-1 break-all">
                  {r.value}
                </code>
                {r.team && r.team.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {r.team.map((a) => (
                      <li
                        key={a.name}
                        className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-0.5 text-xs"
                      >
                        <span
                          className={a.connected ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-fg-disabled"}
                        />
                        {a.name}
                      </li>
                    ))}
                  </ul>
                )}
                {r.extra && (
                  <code className="block mt-1 text-xs bg-secondary rounded px-2 py-1 break-all">
                    {r.extra}
                  </code>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
