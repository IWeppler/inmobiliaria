"use client";

import { useId, useMemo, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LocationSuggestion = {
  city: string;
  province: string;
  count: number;
};

export type SearchValue = {
  // Ciudades elegidas (param `loc`, varias separadas por coma).
  locs: string[];
  // Texto libre confirmado (param `q`): título, calle, barrio, ciudad.
  q: string;
};

const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 6;

// Minúsculas y sin tildes: "cordoba" encuentra "Córdoba".
export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type Option =
  | { kind: "loc"; id: string; loc: LocationSuggestion }
  | { kind: "text"; id: string; text: string };

// Buscador con chips: desde 3 letras sugiere ciudades (sin importar
// mayúsculas ni tildes, primero las que empiezan con lo escrito) y se
// pueden elegir varias. Si nada coincide, el texto se usa como búsqueda
// libre. Teclado: flechas para moverse, Enter elige, Backspace con el
// campo vacío borra el último chip, Escape cierra.
export function LocationCombobox({
  locations,
  value,
  onChange,
  placement = "bottom",
  placeholder = "Barrio, ciudad o dirección",
  className,
  inputClassName,
}: {
  locations: LocationSuggestion[];
  value: SearchValue;
  onChange: (next: SearchValue) => void;
  // Hacia dónde abre la lista (arriba cuando el buscador está al pie de un bloque).
  placement?: "top" | "bottom";
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const baseId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const trimmed = text.trim();
  const options = useMemo<Option[]>(() => {
    if (trimmed.length < MIN_CHARS) return [];
    const n = normalize(trimmed);
    const taken = new Set(value.locs.map(normalize));
    const matches = locations
      .filter((l) => !taken.has(normalize(l.city)))
      .map((l) => ({ l, city: normalize(l.city), province: normalize(l.province) }))
      .filter(({ city, province }) => city.includes(n) || province.includes(n))
      .sort((a, b) => Number(b.city.startsWith(n)) - Number(a.city.startsWith(n)) || b.l.count - a.l.count)
      .slice(0, MAX_SUGGESTIONS)
      .map(({ l }) => ({ kind: "loc" as const, id: `${baseId}-loc-${l.city}`, loc: l }));
    return [...matches, { kind: "text" as const, id: `${baseId}-text`, text: trimmed }];
  }, [trimmed, locations, value.locs, baseId]);

  const expanded = open && options.length > 0;

  const choose = (opt: Option) => {
    if (opt.kind === "loc") onChange({ ...value, locs: [...value.locs, opt.loc.city] });
    else onChange({ ...value, q: opt.text });
    setText("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeLoc = (city: string) => onChange({ ...value, locs: value.locs.filter((c) => c !== city) });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter" && trimmed) {
      // Con texto escrito, Enter elige (sugerencia o texto libre) en vez de enviar.
      e.preventDefault();
      choose(expanded ? options[active] : { kind: "text", id: "", text: trimmed });
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !text) {
      if (value.q) onChange({ ...value, q: "" });
      else if (value.locs.length) removeLoc(value.locs[value.locs.length - 1]);
    }
  };

  const hasChips = value.locs.length > 0 || Boolean(value.q);

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        className="flex min-h-10 w-full min-w-0 cursor-text flex-wrap items-center gap-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />

        {value.locs.map((city) => (
          <span
            key={city}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-main-soft py-1 pr-1 pl-2.5 text-sm font-medium text-main"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{city}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeLoc(city);
              }}
              aria-label={`Quitar ${city}`}
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-main hover:text-primary-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        {value.q && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-sm font-medium text-foreground">
            <span className="truncate">“{value.q}”</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...value, q: "" });
              }}
              aria-label="Quitar búsqueda de texto"
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-foreground hover:text-background"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        )}

        <label htmlFor={`${baseId}-input`} className="sr-only">
          Buscar por ciudad, barrio o dirección
        </label>
        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${baseId}-list`}
          aria-activedescendant={expanded ? options[active]?.id : undefined}
          autoComplete="off"
          value={text}
          placeholder={hasChips ? "Agregar otra zona" : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-8 min-w-[8rem] flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none",
            inputClassName,
          )}
        />
      </div>

      {trimmed.length > 0 && trimmed.length < MIN_CHARS && open && (
        <p className="sr-only" aria-live="polite">
          Escribí al menos {MIN_CHARS} letras para ver sugerencias
        </p>
      )}

      <ul
        id={`${baseId}-list`}
        role="listbox"
        aria-label="Sugerencias"
        hidden={!expanded}
        className={cn(
          "absolute right-0 left-0 z-30 max-h-72 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-[0_16px_40px_-12px_rgb(22_24_26/0.35)]",
          placement === "top" ? "bottom-full mb-3" : "top-full mt-2",
        )}
      >
        {options.map((opt, i) => (
          <li
            key={opt.id}
            id={opt.id}
            role="option"
            aria-selected={i === active}
            // mousedown (no click) para elegir antes de que el blur cierre la lista.
            onMouseDown={(e) => {
              e.preventDefault();
              choose(opt);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm",
              i === active && "bg-muted",
              opt.kind === "text" && options.length > 1 && "mt-1 border-t border-border pt-3",
            )}
          >
            {opt.kind === "loc" ? (
              <>
                <MapPin className="h-4 w-4 shrink-0 text-main" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-foreground">{opt.loc.city}</span>
                  <span className="text-muted-foreground">, {opt.loc.province}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {opt.loc.count} {opt.loc.count === 1 ? "propiedad" : "propiedades"}
                </span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  Buscar “{opt.text}” en títulos y direcciones
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
