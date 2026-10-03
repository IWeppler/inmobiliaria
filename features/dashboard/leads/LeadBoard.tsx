"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2, GripVertical, MoreHorizontal, XCircle } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import type { LeadWithDetails } from "@/app/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/shared/components/ui/kanban";
import { TemperatureBadge } from "@/features/dashboard/leads/TemperatureBadge";
import { LostReasonDialog } from "@/features/dashboard/leads/LostReasonDialog";
import {
  lostReasonLabel,
  type LostReason,
} from "@/features/dashboard/leads/lostReasons";
import {
  LEAD_STATUSES,
  daysBetween,
  normalizeStatus,
  type LeadStatus,
} from "@/features/dashboard/leads/leadStatus";

const BOARD_STATUSES = LEAD_STATUSES.filter(
  (status) => status.value !== "DESCARTADO",
);
const ALL = "__all__";

type LeadBoardProps = {
  initialLeads: LeadWithDetails[];
  isAdmin: boolean;
  statusFilter: string;
  onLeadMoved: (leadId: string, status: LeadStatus, changedAt: string) => void;
};

function LeadCard({
  lead,
  isAdmin,
  onMove,
  isMoving,
  draggable = false,
  isOverlay = false,
}: {
  lead: LeadWithDetails;
  isAdmin: boolean;
  onMove: (leadId: string, status: LeadStatus) => void;
  isMoving: boolean;
  draggable?: boolean;
  isOverlay?: boolean;
}) {
  const currentStatus = normalizeStatus(lead.status);
  const meta = LEAD_STATUSES.find((status) => status.value === currentStatus)!;
  const content = (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-xs transition-[border-color,box-shadow]",
        !isOverlay && "hover:border-border-strong hover:shadow-sm",
        isOverlay && "rotate-1 border-primary/40 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 size-2 shrink-0 rounded-full"
          style={{ backgroundColor: meta.color }}
          aria-hidden
        />
        <Link
          href={`/dashboard/leads/${lead.id}`}
          className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground underline-offset-4 hover:underline"
        >
          {lead.name}
        </Link>
        <TemperatureBadge
          status={lead.status}
          lastActivityAt={lead.last_activity_at}
          iconOnly
        />
        {!isOverlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
                aria-label={`Cambiar estado de ${lead.name}`}
                disabled={isMoving}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {BOARD_STATUSES.filter(
                (status) => status.value !== currentStatus,
              ).map((status) => (
                <DropdownMenuItem
                  key={status.value}
                  onClick={() => onMove(lead.id, status.value)}
                >
                  <status.icon className="size-4" />
                  Mover a {status.label}
                </DropdownMenuItem>
              ))}
              {currentStatus !== "DESCARTADO" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onMove(lead.id, "DESCARTADO")}
                  >
                    <XCircle className="size-4" />
                    Descartar lead
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2 min-h-5">
        {lead.properties ? (
          <Link
            href={`/dashboard/propiedades/${lead.properties.id}`}
            className="inline-flex max-w-full items-center gap-1.5 text-xs text-fg-secondary underline-offset-4 hover:underline"
          >
            <Building2 className="size-3.5 shrink-0" />
            <span className="truncate">{lead.properties.title}</span>
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">
            Sin propiedad asociada
          </span>
        )}
      </div>

      {currentStatus === "DESCARTADO" && (
        <p
          className="mt-2 line-clamp-2 text-xs text-fg-secondary"
          title={lead.lost_reason_note ?? undefined}
        >
          <span className="text-muted-foreground">Motivo: </span>
          {lostReasonLabel(lead.lost_reason) ?? "sin registrar"}
          {lead.lost_reason_note ? `. ${lead.lost_reason_note}` : ""}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate capitalize">
          {lead.source?.toLowerCase().replaceAll("_", " ") ?? "Sin fuente"}
          {isAdmin && lead.agents?.full_name
            ? ` · ${lead.agents.full_name}`
            : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {lead.status_since && (
            <span title="Días en este estado">
              {daysBetween(lead.status_since)} d
            </span>
          )}
          {draggable && <GripVertical className="size-3.5" aria-hidden />}
        </span>
      </div>
    </article>
  );

  return draggable ? (
    <KanbanItem value={lead.id} className="outline-none">
      {isOverlay ? (
        content
      ) : (
        <KanbanItemHandle className="block touch-none cursor-grab active:cursor-grabbing">
          {content}
        </KanbanItemHandle>
      )}
    </KanbanItem>
  ) : (
    content
  );
}

export function LeadBoard({
  initialLeads,
  isAdmin,
  statusFilter,
  onLeadMoved,
}: LeadBoardProps) {
  const supabase = createClientBrowser();
  const [leads, setLeads] = useState(initialLeads);
  const [movingIds, setMovingIds] = useState<string[]>([]);
  const pendingIds = useRef(new Set<string>());
  const [discarding, setDiscarding] = useState<LeadWithDetails | null>(null);
  const isArchive = statusFilter === "DESCARTADO";

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const visibleLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          statusFilter === ALL || normalizeStatus(lead.status) === statusFilter,
      ),
    [leads, statusFilter],
  );
  const columns = useMemo(
    () =>
      Object.fromEntries(
        BOARD_STATUSES.map((status) => [
          status.value,
          visibleLeads.filter(
            (lead) => normalizeStatus(lead.status) === status.value,
          ),
        ]),
      ) as Record<string, LeadWithDetails[]>,
    [visibleLeads],
  );

  const moveLead = async (
    leadId: string,
    newStatus: LeadStatus,
    lost?: { reason: LostReason; note: string | null },
  ) => {
    const lead = leads.find((item) => item.id === leadId);
    if (
      !lead ||
      normalizeStatus(lead.status) === newStatus ||
      pendingIds.current.has(leadId)
    )
      return;
    // Descartar pide el motivo antes de tocar nada.
    if (newStatus === "DESCARTADO" && !lost) {
      setDiscarding(lead);
      return;
    }
    const lostFields =
      newStatus === "DESCARTADO" && lost
        ? { lost_reason: lost.reason, lost_reason_note: lost.note }
        : {};

    pendingIds.current.add(leadId);
    setMovingIds((ids) => [...ids, leadId]);
    const changedAt = new Date().toISOString();
    setLeads((items) =>
      items.map((item) =>
        item.id === leadId
          ? {
              ...item,
              ...lostFields,
              status: newStatus,
              status_since: changedAt,
              last_activity_at: changedAt,
            }
          : item,
      ),
    );

    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus, ...lostFields })
      .eq("id", leadId)
      .select("id")
      .single();
    if (error) {
      setLeads((items) =>
        items.map((item) => (item.id === leadId ? lead : item)),
      );
      toast.error(`No se pudo actualizar el lead: ${error.message}`);
    } else {
      onLeadMoved(leadId, newStatus, changedAt);
      toast.success(
        newStatus === "DESCARTADO"
          ? "Lead archivado como descartado"
          : `Lead movido a ${LEAD_STATUSES.find((status) => status.value === newStatus)?.label}`,
      );
    }
    pendingIds.current.delete(leadId);
    setMovingIds((ids) => ids.filter((id) => id !== leadId));
  };

  const reorderLead = (leadId: string, column: string, overIndex: number) => {
    setLeads((items) => {
      const inColumn = items.filter(
        (item) => normalizeStatus(item.status) === column,
      );
      const fromIndex = inColumn.findIndex((item) => item.id === leadId);
      if (fromIndex < 0 || fromIndex === overIndex) return items;
      const reordered = arrayMove(
        inColumn,
        fromIndex,
        Math.min(overIndex, inColumn.length - 1),
      );
      let nextIndex = 0;
      return items.map((item) =>
        normalizeStatus(item.status) === column ? reordered[nextIndex++] : item,
      );
    });
  };

  return (
    <div className="space-y-3">
      <LostReasonDialog
        leadName={discarding?.name ?? null}
        open={!!discarding}
        onOpenChange={(open) => {
          if (!open) setDiscarding(null);
        }}
        onConfirm={(reason, note) => {
          const lead = discarding;
          setDiscarding(null);
          if (lead) void moveLead(lead.id, "DESCARTADO", { reason, note });
        }}
      />
      {isArchive ? (
        visibleLeads.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                isAdmin={isAdmin}
                onMove={moveLead}
                isMoving={movingIds.includes(lead.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            No hay leads descartados con estos filtros.
          </div>
        )
      ) : (
        <div className="w-full overflow-x-auto pb-2 mx-auto">
          <Kanban
            value={columns}
            onValueChange={() => {}}
            getItemValue={(lead) => lead.id}
            onMove={({ event, activeContainer, overContainer, overIndex }) => {
              if (activeContainer === overContainer)
                reorderLead(
                  String(event.active.id),
                  activeContainer,
                  overIndex,
                );
              else if (
                BOARD_STATUSES.some((status) => status.value === overContainer)
              )
                void moveLead(
                  String(event.active.id),
                  overContainer as LeadStatus,
                );
            }}
          >
            <KanbanBoard className="flex w-full flex-nowrap gap-3">
              {BOARD_STATUSES.map((status) => {
                const items = columns[status.value];
                const Icon = status.icon;
                return (
                  <KanbanColumn
                    key={status.value}
                    value={status.value}
                    className="min-h-[420px] min-w-[190px] max-w-[320px] flex-1 basis-0 rounded-xl border border-border bg-sunken p-2"
                  >
                    <div className="mb-2 flex items-center gap-2 px-2 py-2">
                      <span
                        className="flex size-7 items-center justify-center rounded-md"
                        style={{
                          backgroundColor: status.bg,
                          color: status.color,
                        }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {status.label}
                      </h3>
                      <Badge variant="neutral" className="tabular-nums">
                        {items.length}
                      </Badge>
                    </div>
                    <KanbanColumnContent
                      value={status.value}
                      className="min-h-[340px] gap-2"
                    >
                      {items.length ? (
                        items.map((lead) => (
                          <LeadCard
                            key={lead.id}
                            lead={lead}
                            isAdmin={isAdmin}
                            onMove={moveLead}
                            isMoving={movingIds.includes(lead.id)}
                            draggable
                          />
                        ))
                      ) : (
                        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                          Sin leads en esta etapa
                        </p>
                      )}
                    </KanbanColumnContent>
                  </KanbanColumn>
                );
              })}
            </KanbanBoard>
            <KanbanOverlay>
              {({ value }) => {
                const lead = leads.find((item) => item.id === value);
                return lead ? (
                  <LeadCard
                    lead={lead}
                    isAdmin={isAdmin}
                    onMove={moveLead}
                    isMoving
                    draggable
                    isOverlay
                  />
                ) : null;
              }}
            </KanbanOverlay>
          </Kanban>
        </div>
      )}
    </div>
  );
}
