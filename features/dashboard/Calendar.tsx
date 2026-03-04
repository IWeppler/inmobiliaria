"use client";

import { useState, useEffect } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  ChevronLeft,
  Plus,
  Clock,
  Calendar as CalendarIcon,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { es } from "date-fns/locale";
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfDay,
} from "date-fns";

type CalendarItem = {
  id: string;
  date: Date;
  title: string;
  time: string;
  type: "event";
};

const TIME_OPTIONS = Array.from({ length: 96 }).map((_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
});

export function DashboardCalendar() {
  const supabase = createClientBrowser();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [view, setView] = useState<"calendar" | "day">("calendar");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState<{ title: string; time: string }>({
    title: "",
    time: "09:00",
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();

      // Traer Eventos Manuales (Visitas, Reuniones, etc.)
      const { data: eventsRes, error } = await supabase
        .from("events")
        .select("*")
        .gte("date", start)
        .lte("date", end);

      if (isMounted) {
        const combinedItems: CalendarItem[] = [];

        if (eventsRes && !error) {
          eventsRes.forEach((e) => {
            combinedItems.push({
              id: e.id,
              date: new Date(e.date),
              title: e.title,
              time: e.time,
              type: "event",
            });
          });
        }

        setItems(combinedItems);
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [currentMonth, supabase]);

  const selectedDayItems = items.filter(
    (item) => date && isSameDay(item.date, date),
  );

  const handleSelectDate = (selected: Date | undefined) => {
    setDate(selected);
    if (selected) {
      setView("day");
      setIsAdding(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!date || !newNote.title.trim()) return;
    setIsSaving(true);

    const eventDate = startOfDay(date).toISOString();

    const { data, error } = await supabase
      .from("events")
      .insert({
        date: eventDate,
        title: newNote.title,
        time: newNote.time,
      })
      .select()
      .single();

    if (!error && data) {
      const newEvent: CalendarItem = {
        id: data.id,
        date: new Date(data.date),
        title: data.title,
        time: data.time,
        type: "event",
      };
      setItems((prev) => [...prev, newEvent]);
      setIsAdding(false);
      setNewNote({ title: "", time: "09:00" });
    }
    setIsSaving(false);
  };

  const handleDeleteEvent = async (id: string) => {
    const previousItems = items;
    setItems(items.filter((e) => e.id !== id));

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      setItems(previousItems);
    }
  };

  return (
    <Card className="shadow-sm border-zinc-200 w-full h-fit flex flex-col overflow-hidden rounded-xl relative">
      <CardHeader className="px-4 py-3 border-b border-zinc-100 flex justify-center z-20 relative bg-white">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {view === "day" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -ml-2 hover:bg-zinc-100 rounded-full text-zinc-500"
                onClick={() => {
                  setView("calendar");
                  setIsAdding(false);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle className="text-sm font-semibold text-zinc-900">
              {view === "calendar" ? (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-blue-600" />
                  <span>Agenda</span>
                </div>
              ) : (
                <span className="capitalize">
                  {date ? format(date, "EEEE d", { locale: es }) : "Detalle"}
                </span>
              )}
            </CardTitle>
          </div>
          {view === "calendar" ? (
            <div className="flex items-center gap-2">
              {isLoading && (
                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
              )}
              <span className="text-xs font-medium text-zinc-500 capitalize">
                {format(currentMonth, "MMMM", { locale: es })}
              </span>
            </div>
          ) : (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-2 font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            >
              {selectedDayItems.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 relative bg-white z-10 flex flex-col">
        {/* VISTA 1: CALENDARIO */}
        {view === "calendar" && (
          <div className="flex-1 w-full flex items-center justify-center p-2 animate-in zoom-in-95 duration-200">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelectDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={es}
              className="p-0 border-none shadow-none w-full flex justify-center"
              classNames={{
                month: "space-y-2 w-full",
                table: "w-full border-collapse space-y-1 mx-auto",
                head_row: "flex justify-between mb-2 px-2",
                head_cell:
                  "text-zinc-500 rounded-md w-8 font-medium text-[0.75rem] capitalize",
                row: "flex w-full mt-1 justify-between px-2",
                cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                day: "h-8 w-8 p-0 font-medium text-sm aria-selected:opacity-100 hover:bg-zinc-100 rounded-md transition-colors text-zinc-900",
                day_selected:
                  "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white shadow-md shadow-blue-600/20",
                day_today: "bg-zinc-100 text-zinc-900 font-bold",
                day_outside: "text-zinc-400 opacity-50",
                day_disabled: "text-zinc-200 opacity-50",
                day_hidden: "invisible",
              }}
              modifiers={{
                hasEvent: (day) =>
                  items.some(
                    (e) => e.type === "event" && isSameDay(e.date, day),
                  ),
              }}
              modifiersClassNames={{
                hasEvent:
                  "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-blue-600 after:rounded-full",
              }}
            />
          </div>
        )}

        {/* VISTA 2: DETALLE DÍA */}
        {view === "day" && (
          <div className="flex-1 flex flex-col w-full bg-white animate-in slide-in-from-right-4 duration-300 relative min-h-[250px]">
            <ScrollArea className="flex-1 p-4 pb-0 max-h-[250px]">
              {selectedDayItems.length > 0 ? (
                <div className="space-y-2 pb-4">
                  {selectedDayItems.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 p-2.5 rounded-lg border border-zinc-200 hover:border-blue-200 transition-all bg-white shadow-sm hover:shadow"
                    >
                      <span className="text-[10px] font-bold w-10 text-right shrink-0 text-zinc-500">
                        {item.time}
                      </span>
                      <div className="h-8 w-1 rounded-full shrink-0 bg-blue-500" />
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 leading-tight truncate">
                          {item.title}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEvent(item.id)}
                        className="h-6 w-6 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                !isAdding && (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 py-8">
                    <div className="h-10 w-10 bg-zinc-50 rounded-full flex items-center justify-center mb-1 border border-zinc-100">
                      <Clock className="h-5 w-5 text-zinc-300" />
                    </div>
                    <p className="text-xs font-medium">Sin eventos para hoy.</p>
                  </div>
                )
              )}
            </ScrollArea>

            {/* FORMULARIO FLOTANTE */}
            {isAdding ? (
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 animate-in slide-in-from-bottom-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-900">
                      Nuevo Evento
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-zinc-500 hover:bg-zinc-200"
                      onClick={() => setIsAdding(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* SEPARACIÓN MEJORADA (gap-4) */}
                  <div className="flex gap-4">
                    {/* INPUT DE HORA MÁS ANCHO (w-28) */}
                    <div className="w-28 shrink-0">
                      <Label className="text-[10px] text-zinc-500 uppercase mb-1.5 block font-bold tracking-wide">
                        Hora
                      </Label>
                      <Select
                        value={newNote.time}
                        onValueChange={(v) =>
                          setNewNote({ ...newNote, time: v })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs bg-white w-full border-zinc-200 focus:ring-blue-600">
                          <SelectValue placeholder="Hora" />
                        </SelectTrigger>
                        <SelectContent className="h-48">
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem
                              key={time}
                              value={time}
                              className="text-xs focus:bg-blue-50 focus:text-blue-900"
                            >
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* INPUT DE DETALLE */}
                    <div className="flex-1">
                      <Label className="text-[10px] text-zinc-500 uppercase mb-1.5 block font-bold tracking-wide">
                        Detalle
                      </Label>
                      <Input
                        placeholder="Ej: Llamada..."
                        className="h-9 text-xs bg-white w-full border-zinc-200 focus-visible:ring-blue-600"
                        value={newNote.title}
                        onChange={(e) =>
                          setNewNote({ ...newNote, title: e.target.value })
                        }
                        autoFocus
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSaveEvent()
                        }
                      />
                    </div>
                  </div>

                  {/* BOTÓN GUARDAR (Azul) */}
                  <Button
                    onClick={handleSaveEvent}
                    disabled={isSaving || !newNote.title.trim()}
                    className="w-full h-9 mt-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-2 transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Guardar Evento
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-t border-zinc-100 bg-white z-10">
                <Button
                  onClick={() => setIsAdding(true)}
                  variant="outline"
                  className="w-full bg-white hover:bg-zinc-100  text-blue-600 hover:text-blue-700 border-dashed border-blue-200 h-9 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" /> Agregar Evento
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
