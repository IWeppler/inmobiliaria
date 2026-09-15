"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  createBookingAction,
  type BookingState,
} from "@/features/booking/createBookingAction";
import type { DayAvailability } from "@/features/booking/availability";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function dayLabel(ymd: string, weekday: number) {
  const [, m, d] = ymd.split("-");
  return {
    weekday: WEEKDAYS[weekday],
    day: String(Number(d)),
    month: MONTHS[Number(m) - 1],
  };
}

function longDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

const initialState: BookingState = { success: false, message: "" };

// E3.2 — Formulario público de agendado: día (chips), horario (chips) y
// datos de contacto. Sin cuenta, sin login.
export function BookingForm({
  propertyId,
  days,
}: {
  propertyId: string;
  days: DayAvailability[];
}) {
  const firstOpen = days.find((d) => d.slots.some((s) => s.available));
  const [date, setDate] = useState(firstOpen?.ymd ?? "");
  const [time, setTime] = useState("");
  const [state, action, pending] = useActionState(
    createBookingAction,
    initialState
  );

  useEffect(() => {
    if (state.message && !state.success) toast.error(state.message);
  }, [state]);

  const selectedDay = days.find((d) => d.ymd === date);

  if (state.success && state.booking) {
    const b = state.booking;
    const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(b.ics)}`;
    return (
      <div className="bg-white p-6 md:p-8 rounded-xl border border-zinc-100 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-green-50 text-green-700">
            <CalendarCheck className="size-6" />
          </div>
          <h2 className="font-clash text-2xl font-semibold text-zinc-900">
            ¡Visita agendada!
          </h2>
        </div>
        <p className="text-zinc-600 mb-6">{state.message}</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8">
          <div>
            <dt className="text-zinc-500">Cuándo</dt>
            <dd className="font-semibold text-zinc-900 capitalize">
              {longDate(b.date)} · {b.time} hs
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Con</dt>
            <dd className="font-semibold text-zinc-900">{b.agentName}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Dónde</dt>
            <dd className="font-semibold text-zinc-900">
              {b.propertyTitle}
              {b.address && (
                <span className="block font-normal text-zinc-600">{b.address}</span>
              )}
            </dd>
          </div>
        </dl>
        <Button asChild variant="outline">
          <a href={icsHref} download="visita.ics">
            <Download className="mr-2 size-4" />
            Agregar a mi calendario
          </a>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="bg-white p-6 md:p-8 rounded-xl border border-zinc-100 shadow-lg space-y-8"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      {/* 1. Día */}
      <section>
        <h2 className="font-clash text-lg font-semibold text-zinc-900 mb-3">
          1. Elegí el día
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {days.map((d) => {
            const hasSlots = d.slots.some((s) => s.available);
            const l = dayLabel(d.ymd, d.weekday);
            const selected = d.ymd === date;
            return (
              <button
                key={d.ymd}
                type="button"
                disabled={!hasSlots}
                onClick={() => {
                  setDate(d.ymd);
                  setTime("");
                }}
                className={cn(
                  "flex flex-col items-center shrink-0 w-[68px] rounded-lg border px-2 py-2 text-sm transition-colors",
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400",
                  !hasSlots && "opacity-40 cursor-not-allowed hover:border-zinc-200"
                )}
              >
                <span className="text-[11px] uppercase tracking-wide opacity-80">
                  {l.weekday}
                </span>
                <span className="text-xl font-semibold leading-tight">{l.day}</span>
                <span className="text-[11px] opacity-80">{l.month}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Horario */}
      <section>
        <h2 className="font-clash text-lg font-semibold text-zinc-900 mb-3">
          2. Elegí el horario
        </h2>
        {!selectedDay ? (
          <p className="text-sm text-zinc-500">Primero elegí un día.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {selectedDay.slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available}
                onClick={() => setTime(s.time)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium tabular-nums transition-colors",
                  time === s.time
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400",
                  !s.available &&
                    "opacity-40 cursor-not-allowed line-through hover:border-zinc-200"
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 3. Datos */}
      <section className="space-y-4">
        <h2 className="font-clash text-lg font-semibold text-zinc-900">
          3. Tus datos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre y apellido</Label>
            <Input id="name" name="name" required minLength={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono / WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" required minLength={8} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="message">Comentario (opcional)</Label>
            <Textarea id="message" name="message" rows={3} maxLength={1000} />
          </div>
        </div>
      </section>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || !date || !time}
      >
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <CalendarCheck className="mr-2 size-4" />
        )}
        {date && time ? `Confirmar visita · ${time} hs` : "Elegí día y horario"}
      </Button>
    </form>
  );
}
