"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  MapPin,
  Sun,
  Sunset,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

function dayLabel(ymd: string, weekday: number, index: number) {
  const [, m, d] = ymd.split("-");
  return {
    weekday: index === 0 ? "Hoy" : index === 1 ? "Mañana" : WEEKDAYS[weekday],
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

function endTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const initialState: BookingState = { success: false, message: "" };

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-clash text-lg font-semibold text-zinc-900">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
          done ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600",
        )}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      {children}
    </h2>
  );
}

function SlotGroup({
  icon: Icon,
  label,
  slots,
  selected,
  onSelect,
}: {
  icon: React.ElementType;
  label: string;
  slots: DayAvailability["slots"];
  selected: string;
  onSelect: (time: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {slots.map((s) => (
          <button
            key={s.time}
            type="button"
            disabled={!s.available}
            onClick={() => onSelect(s.time)}
            aria-pressed={selected === s.time}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold tabular-nums transition",
              selected === s.time
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-900",
              !s.available &&
                "cursor-not-allowed border-dashed bg-zinc-50 text-zinc-400 line-through hover:border-zinc-200",
            )}
          >
            {s.time}
          </button>
        ))}
      </div>
    </div>
  );
}

// E3.2 — Formulario público de agendado: día, horario y datos de
// contacto. Sin cuenta, sin login.
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
  const [state, action, pending] = useActionState(createBookingAction, initialState);
  const daysRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message && !state.success) toast.error(state.message);
    if (state.success) successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  const selectedDay = days.find((d) => d.ymd === date);
  const morning = selectedDay?.slots.filter((s) => s.time < "13:00") ?? [];
  const afternoon = selectedDay?.slots.filter((s) => s.time >= "13:00") ?? [];

  const scrollDays = (dir: 1 | -1) =>
    daysRef.current?.scrollBy({ left: dir * daysRef.current.clientWidth * 0.8, behavior: "smooth" });

  if (state.success && state.booking) {
    const b = state.booking;
    const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(b.ics)}`;
    const [, m, d] = b.date.split("-");
    return (
      <div
        ref={successRef}
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)]"
      >
        <div className="border-b border-emerald-100 bg-emerald-50/60 p-6 md:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <h2 className="mt-4 font-clash text-2xl font-semibold text-zinc-900 md:text-3xl">
            ¡Listo, tu visita está agendada!
          </h2>
          <p className="mt-2 text-zinc-600">{state.message}</p>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex gap-4 rounded-xl border border-zinc-200 p-4">
            <div className="flex w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-zinc-200 text-center">
              <span className="w-full bg-zinc-900 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                {MONTHS[Number(m) - 1]}
              </span>
              <span className="py-1 font-clash text-2xl font-semibold text-zinc-900">{Number(d)}</span>
            </div>
            <dl className="min-w-0 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Cuándo</dt>
                <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                <dd className="font-semibold capitalize text-zinc-900">
                  {longDate(b.date)} · {b.time} a {endTime(b.time)} hs
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="sr-only">Dónde</dt>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <dd className="text-zinc-700">
                  <span className="font-medium text-zinc-900">{b.propertyTitle}</span>
                  {b.address && <span className="block text-zinc-500">{b.address}</span>}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">Con</dt>
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                <dd className="text-zinc-700">Te recibe {b.agentName}</dd>
              </div>
            </dl>
          </div>

          <p className="mt-6 mb-3 text-sm font-semibold text-zinc-900">Sumala a tu calendario</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <a
              href={b.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <GoogleCalendarIcon />
              Google Calendar
            </a>
            <a
              href={b.outlookCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              <CalendarPlus className="h-4 w-4" />
              Outlook
            </a>
          </div>
          <a
            href={icsHref}
            download="visita.ics"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Apple Calendar u otro (.ics)
          </a>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-zinc-100 pt-6">
            <Link
              href={`/propiedades/${propertyId}`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Volver a la propiedad
            </Link>
            <Link
              href="/propiedades"
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
            >
              Ver otras propiedades
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)]"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      <div className="divide-y divide-zinc-100">
        {/* 1. Día */}
        <section className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <StepTitle n={1} done={Boolean(date)}>
              Elegí el día
            </StepTitle>
            <div className="hidden gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => scrollDays(-1)}
                aria-label="Días anteriores"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollDays(1)}
                aria-label="Días siguientes"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div
            ref={daysRef}
            className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden"
          >
            {days.map((d, i) => {
              const open = d.slots.filter((s) => s.available).length;
              const l = dayLabel(d.ymd, d.weekday, i);
              const selected = d.ymd === date;
              return (
                <button
                  key={d.ymd}
                  type="button"
                  disabled={open === 0}
                  aria-pressed={selected}
                  onClick={() => {
                    setDate(d.ymd);
                    setTime("");
                  }}
                  className={cn(
                    "flex w-[76px] shrink-0 snap-start flex-col items-center rounded-xl border px-2 pt-2.5 pb-2 transition",
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-900",
                    open === 0 && "cursor-not-allowed border-dashed bg-zinc-50 text-zinc-400 hover:border-zinc-200",
                  )}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-75">{l.weekday}</span>
                  <span className="font-clash text-2xl font-semibold leading-tight">{l.day}</span>
                  <span className="text-[11px] opacity-75">{l.month}</span>
                  <span
                    className={cn(
                      "mt-1.5 text-[10px] font-medium",
                      selected ? "text-white/70" : open === 0 ? "text-zinc-400" : "text-emerald-700",
                    )}
                  >
                    {open === 0 ? "Sin turnos" : `${open} ${open === 1 ? "turno" : "turnos"}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Horario */}
        <section className="p-6 md:p-8">
          <StepTitle n={2} done={Boolean(time)}>
            Elegí el horario
          </StepTitle>
          {!selectedDay ? (
            <p className="text-sm text-zinc-500">Primero elegí un día.</p>
          ) : (
            <div className="space-y-5">
              <p className="text-sm capitalize text-zinc-600">{longDate(selectedDay.ymd)}</p>
              <SlotGroup icon={Sun} label="Mañana" slots={morning} selected={time} onSelect={setTime} />
              <SlotGroup icon={Sunset} label="Tarde" slots={afternoon} selected={time} onSelect={setTime} />
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                La visita dura aproximadamente 1 hora.
              </p>
            </div>
          )}
        </section>

        {/* 3. Datos */}
        <section className="p-6 md:p-8">
          <StepTitle n={3} done={false}>
            Tus datos
          </StepTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre y apellido</Label>
              <Input id="name" name="name" required minLength={3} autoComplete="name" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono / WhatsApp</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                minLength={8}
                autoComplete="tel"
                placeholder="11 2345 6789"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">
                Email <span className="font-normal text-zinc-400">(opcional)</span>
              </Label>
              <Input id="email" name="email" type="email" autoComplete="email" className="h-11" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="message">
                Comentario <span className="font-normal text-zinc-400">(opcional)</span>
              </Label>
              <Textarea
                id="message"
                name="message"
                rows={3}
                maxLength={1000}
                placeholder="Ej.: voy con mi pareja, me interesa saber si acepta mascotas…"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Resumen + confirmar */}
      <div className="border-t border-zinc-200 bg-zinc-50 p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="text-zinc-500">Tu visita</p>
            <p className="font-semibold capitalize text-zinc-900">
              {date && time
                ? `${longDate(date)} · ${time} hs`
                : date
                  ? `${longDate(date)} · elegí un horario`
                  : "Elegí día y horario"}
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || !date || !time}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-56"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            {pending ? "Confirmando…" : "Confirmar visita"}
          </button>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Sin costo ni compromiso. Te confirmamos por WhatsApp o teléfono.
        </p>
      </div>
    </form>
  );
}

function GoogleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2.5" fill="#fff" />
      <rect x="3" y="4" width="18" height="5" rx="2.5" fill="#4285F4" />
      <rect x="3" y="7" width="18" height="2" fill="#4285F4" />
      <text x="12" y="18.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1a73e8" fontFamily="Arial, sans-serif">
        31
      </text>
    </svg>
  );
}
