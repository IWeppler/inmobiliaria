import { Rss, MessageCircle, CalendarCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { BRAND } from "@/lib/brand";

// Tier 3: estado y URLs de las integraciones. Solo lectura -- la
// configuración real vive en variables de entorno del deployment.
export function Integrations({
  whatsappEnabled,
  aiAgentEnabled,
}: {
  whatsappEnabled: boolean;
  aiAgentEnabled: boolean;
}) {
  const rows = [
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
        ? `Conectado. Confirmaciones de visita por plantilla y mensajes entrantes como notas del lead.${
            aiAgentEnabled
              ? " Agente IA activo: responde consultas y deriva al asesor."
              : " Agente IA desactivado (WHATSAPP_AI_AGENT)."
          }`
        : "No configurado. Requiere WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_VERIFY_TOKEN en el deployment, y el webhook apuntando a la URL de abajo.",
      value: `${BRAND.siteUrl}/api/whatsapp/webhook`,
      status: whatsappEnabled ? "Conectado" : "Pendiente",
    },
  ];

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Integraciones</CardTitle>
        <CardDescription>
          Portales, agenda pública y WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.title} className="py-4 first:pt-0 last:pb-0 flex gap-3">
              <div className="p-2 rounded-full bg-secondary text-muted-foreground h-fit">
                <r.icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{r.title}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "Pendiente"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                <code className="block mt-2 text-xs bg-secondary rounded px-2 py-1 break-all">
                  {r.value}
                </code>
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
