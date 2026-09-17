"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Inbox, Search } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { propertyStatusMeta, formatPrice } from "@/features/dashboard/property/propertyStatus";
import { statusMeta } from "@/features/dashboard/leads/leadStatus";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE } from "@/features/rentals/logic";
import { cn } from "@/lib/utils";

type Result = {
  kind: "property" | "lead" | "contract";
  id: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  href: string;
};

const GROUPS: { kind: Result["kind"]; label: string; icon: typeof Search }[] = [
  { kind: "property", label: "Propiedades", icon: Building2 },
  { kind: "lead", label: "Leads", icon: Inbox },
  { kind: "contract", label: "Contratos", icon: FileText },
];

function escapeLike(q: string) {
  return q.replace(/[%_,]/g, " ").trim();
}

// Búsqueda global: un solo campo para propiedades, leads y contratos.
// Se abre con ⌘K / Ctrl+K; navegación con flechas y Enter. Las queries
// pasan por RLS, así que cada usuario ve lo que ya podía ver.
export function GlobalSearch() {
  const router = useRouter();
  const supabase = createClientBrowser();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (o) {
            setQuery("");
            setResults([]);
            setActive(0);
          }
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const search = useCallback(
    async (raw: string) => {
      const q = escapeLike(raw);
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const like = `%${q}%`;
      const [props, leads, contracts] = await Promise.all([
        supabase
          .from("properties")
          .select("id, title, street_address, city, status, price, currency")
          .or(`title.ilike.${like},street_address.ilike.${like},city.ilike.${like}`)
          .limit(5),
        supabase
          .from("leads")
          .select("id, name, email, phone, status, properties(title)")
          .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(5),
        supabase
          .from("rental_contracts")
          .select("id, status, properties!inner(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name)")
          .ilike("properties.title", like)
          .limit(4),
      ]);

      const out: Result[] = [];
      for (const p of props.data ?? []) {
        const m = propertyStatusMeta(p.status);
        out.push({
          kind: "property",
          id: p.id,
          title: p.title,
          subtitle: [p.street_address, p.city].filter(Boolean).join(" · ") || undefined,
          badge: (
            <>
              {formatPrice(p.price, p.currency) && (
                <span className="text-xs text-muted-foreground">{formatPrice(p.price, p.currency)}</span>
              )}
              <StatusBadge tone={m.tone} color={m.color} icon={m.icon}>{m.label}</StatusBadge>
            </>
          ),
          href: `/dashboard/propiedades/${p.id}`,
        });
      }
      for (const l of leads.data ?? []) {
        const m = statusMeta(l.status);
        const prop = l.properties as unknown as { title: string } | null;
        out.push({
          kind: "lead",
          id: l.id,
          title: l.name,
          subtitle: prop?.title ?? l.phone ?? l.email ?? undefined,
          badge: <StatusBadge tone={m.tone} icon={m.icon}>{m.label}</StatusBadge>,
          href: `/dashboard/leads/${l.id}`,
        });
      }
      for (const c of contracts.data ?? []) {
        const prop = c.properties as unknown as { title: string } | null;
        const tenant = c.tenant as unknown as { full_name: string } | null;
        out.push({
          kind: "contract",
          id: c.id,
          title: prop?.title ?? "Contrato",
          subtitle: tenant?.full_name,
          badge: (
            <StatusBadge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>
              {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
            </StatusBadge>
          ),
          href: `/dashboard/alquileres/${c.id}`,
        });
      }
      setResults(out);
      setActive(0);
      setLoading(false);
    },
    [supabase],
  );

  // Debounce corto: la búsqueda es liviana pero no hace falta pegarle por tecla.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 180);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: results.filter((r) => r.kind === g.kind) })).filter((g) => g.items.length > 0),
    [results],
  );
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Al cerrar se limpia el estado acá (no en un effect) para evitar renders en cascada.
  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  };

  const go = (r: Result) => {
    setOpenAndReset(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 w-56 justify-start gap-2 px-2.5 text-muted-foreground font-normal max-md:w-8 max-md:justify-center max-md:px-0"
        aria-label="Buscar"
      >
        <Search className="size-4" />
        <span className="max-md:hidden">Buscar…</span>
        <kbd className="ml-auto rounded-sm border border-border bg-muted px-1 text-[11px] font-medium text-muted-foreground max-md:hidden">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpenAndReset}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <div className="flex h-12 items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Propiedad, lead, contrato…"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls="global-search-results"
              aria-activedescendant={flat[active] ? `gs-${flat[active].kind}-${flat[active].id}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="rounded-sm border border-border bg-muted px-1 text-[11px] text-muted-foreground">Esc</kbd>
          </div>

          <div id="global-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Escribí al menos dos letras.
              </p>
            ) : flat.length === 0 && !loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Sin resultados para &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              grouped.map((g) => (
                <div key={g.kind} className="py-1">
                  <div className="flex h-7 items-center gap-1.5 px-3 text-xs font-medium text-muted-foreground">
                    <g.icon className="size-3.5" />
                    {g.label}
                  </div>
                  {g.items.map((r) => {
                    const idx = flat.indexOf(r);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        id={`gs-${r.kind}-${r.id}`}
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(r)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                          idx === active ? "bg-muted" : "hover:bg-muted/50",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{r.title}</span>
                          {r.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">{r.badge}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
