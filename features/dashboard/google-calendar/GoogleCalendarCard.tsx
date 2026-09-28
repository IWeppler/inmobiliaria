"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { disconnectGoogleCalendarAction } from "@/features/dashboard/google-calendar/actions";
import { GoogleCalendarLogo } from "@/features/dashboard/google-calendar/GoogleCalendarLogo";

type Props = {
  enabled: boolean;
  connection: { google_email: string | null; last_error: string | null } | null;
};

const RESULT_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Google Calendar conectado. Tus próximos eventos ya se sincronizaron." },
  cancelled: { ok: false, text: "Cancelaste la conexión con Google." },
  error: { ok: false, text: "No se pudo conectar Google Calendar. Probá de nuevo." },
  disabled: { ok: false, text: "La integración con Google no está configurada." },
};

const CONNECT_HREF = "/api/google-calendar/connect?next=/dashboard/perfil";

// Conexión personal con Google Calendar (Mi perfil). Cada integrante
// conecta su cuenta; los eventos a su nombre se copian a su calendario.
export function GoogleCalendarCard({ enabled, connection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Resultado del OAuth (?google=...): toast y se limpia la URL.
  useEffect(() => {
    const result = searchParams.get("google");
    const message = result ? RESULT_MESSAGES[result] : null;
    if (!message) return;
    if (message.ok) toast.success(message.text);
    else toast.error(message.text);
    const url = new URL(window.location.href);
    url.searchParams.delete("google");
    router.replace(url.pathname + url.search + url.hash, { scroll: false });
  }, [searchParams, router]);

  const disconnect = () =>
    startTransition(async () => {
      const { error } = await disconnectGoogleCalendarAction();
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Google Calendar desconectado.");
      router.refresh();
    });

  const tone = connection ? (connection.last_error ? "warning" : "success") : "neutral";
  const status = connection ? (connection.last_error ? "Revisar" : "Conectado") : "No conectado";

  return (
    <Card id="google-calendar" className="scroll-mt-16">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <GoogleCalendarLogo className="mt-0.5 size-8 shrink-0" />
            <div>
              <CardTitle>Google Calendar</CardTitle>
              <CardDescription className="mt-1">
                Tus visitas, llamadas y reuniones aparecen solas en tu calendario de Google, con
                recordatorios en el celular.
              </CardDescription>
            </div>
          </div>
          {enabled && <StatusBadge tone={tone}>{status}</StatusBadge>}
        </div>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            La integración todavía no está habilitada. Pedile al administrador que configure las
            credenciales de Google.
          </p>
        ) : connection ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-sunken px-3 py-2 text-sm">
              <Check className="size-4 text-success" />
              Sincronizando con
              <span className="font-medium">{connection.google_email ?? "tu cuenta de Google"}</span>
            </div>
            {connection.last_error && (
              <div className="flex gap-2 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{connection.last_error} Si se repite, reconectá tu cuenta.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={CONNECT_HREF}>
                  <RefreshCw />
                  Reconectar
                </a>
              </Button>
              <Button variant="ghost" onClick={disconnect} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• Los eventos nuevos y las visitas agendadas online se copian a tu calendario.</li>
              <li>• Si borrás un evento en el panel, también se borra en Google.</li>
              <li>• Solo pedimos permiso para gestionar eventos del calendario.</li>
            </ul>
            <Button asChild>
              <a href={CONNECT_HREF}>
                <GoogleCalendarLogo className="size-4" />
                Conectar Google Calendar
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
