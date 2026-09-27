"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";

// Date picker de shadcn (Popover + Calendar). Trabaja con strings
// YYYY-MM-DD como los <input type="date"> que reemplaza, y muestra
// siempre DD/MM/AAAA sin depender del locale del navegador.
function toDate(ymd: string) {
  return ymd ? new Date(`${ymd}T12:00:00`) : undefined;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between px-3 font-normal tabular-nums",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected ? format(selected, "dd/MM/yyyy") : placeholder}
          <CalendarIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
