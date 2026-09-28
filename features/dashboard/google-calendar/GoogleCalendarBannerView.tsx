"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { dismissGoogleCalendarBannerAction } from "@/features/dashboard/google-calendar/actions";
import { GoogleCalendarLogo } from "@/features/dashboard/google-calendar/GoogleCalendarLogo";

export function GoogleCalendarBannerView({ needsReconnect }: { needsReconnect: boolean }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    startTransition(() => dismissGoogleCalendarBannerAction());
  };

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-info-border bg-info-bg px-3 py-2 text-sm md:px-4"
    >
      <GoogleCalendarLogo className="size-5 shrink-0" />
      <p className="min-w-0 flex-1 text-foreground">
        {needsReconnect ? (
          <>
            <span className="font-medium">Se cortó la sincronización con Google Calendar.</span>{" "}
            <span className="hidden text-fg-secondary sm:inline">
              Reconectá tu cuenta para no perderte visitas.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Conectá tu Google Calendar</span>{" "}
            <span className="hidden text-fg-secondary sm:inline">
              y recibí tus visitas y reuniones con recordatorios en el celular.
            </span>
          </>
        )}
      </p>
      <Button size="sm" asChild>
        <a href={`/api/google-calendar/connect?next=${encodeURIComponent(pathname)}`}>
          {needsReconnect ? "Reconectar" : "Conectar"}
        </a>
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar aviso"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-background/60 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
