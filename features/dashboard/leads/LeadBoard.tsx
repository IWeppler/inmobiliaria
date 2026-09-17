"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { STATUS_TONE_COLOR } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { LeadWithDetails } from "@/app/types";
import {
  LEAD_STATUSES,
  normalizeStatus,
  daysBetween,
  type LeadStatus,
} from "@/features/dashboard/leads/leadStatus";
import { TemperatureBadge } from "@/features/dashboard/leads/TemperatureBadge";

type LeadBoardProps = {
  initialLeads: LeadWithDetails[];
  isAdmin: boolean;
};

// E1.1 — Kanban de leads. Drag & drop nativo (HTML5) para no sumar una
// dependencia: una columna por valor del enum lead_status, en el orden de
// LEAD_STATUSES. Soltar una card en otra columna hace el UPDATE de status;
// el trigger log_status_change registra el cambio en status_history.
export function LeadBoard({ initialLeads, isAdmin }: LeadBoardProps) {
  const supabase = createClientBrowser();
  const [leads, setLeads] = useState(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<LeadStatus | null>(null);

  const moveLead = async (leadId: string, newStatus: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || normalizeStatus(lead.status) === newStatus) return;

    const previous = leads;
    const nowIso = new Date().toISOString();
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, status: newStatus, status_since: nowIso, last_activity_at: nowIso }
          : l
      )
    );

    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      toast.error(`Error al mover el lead: ${error.message}`);
      setLeads(previous);
    }
  };

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-2">
      {LEAD_STATUSES.map((col) => {
        const items = leads.filter(
          (l) => normalizeStatus(l.status) === col.value
        );
        const Icon = col.icon;
        const isOver = overColumn === col.value;

        return (
          <div
            key={col.value}
            className={cn(
              "flex min-w-[220px] flex-1 basis-0 flex-col rounded-lg bg-sunken transition-colors",
              isOver && "ring-2 ring-ring/40"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (overColumn !== col.value) setOverColumn(col.value);
            }}
            onDragLeave={(e) => {
              // Solo limpiar si salimos de la columna, no de un hijo.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverColumn(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/lead-id") || draggingId;
              setOverColumn(null);
              setDraggingId(null);
              if (id) moveLead(id, col.value);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="size-3.5" style={{ color: STATUS_TONE_COLOR[col.tone] }} />
                {col.label}
              </div>
              <span className="text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-2 min-h-[120px]">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Sin leads
                </p>
              )}
              {items.map((lead) => (
                <article
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/lead-id", lead.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(lead.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                  className={cn(
                    "rounded-md border border-border bg-card px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors hover:border-border-strong",
                    draggingId === lead.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="truncate text-sm font-medium leading-tight text-foreground underline-offset-4 hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <TemperatureBadge
                      status={lead.status}
                      lastActivityAt={lead.last_activity_at}
                      iconOnly
                    />
                  </div>

                  {lead.properties?.title && (
                    <p className="mt-1 truncate text-xs text-fg-secondary">
                      <Link
                        href={`/dashboard/propiedades/${lead.properties.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {lead.properties.title}
                      </Link>
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate capitalize">
                      {lead.source?.toLowerCase().replaceAll("_", " ") ?? "—"}
                      {isAdmin && lead.agents?.full_name && (
                        <> · {lead.agents.full_name}</>
                      )}
                    </span>
                    {lead.status_since && (
                      <span className="shrink-0" title="Días en este estado">
                        {daysBetween(lead.status_since)} d
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
