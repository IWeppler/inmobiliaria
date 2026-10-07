"use client";

import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { LeadWithDetails } from "@/app/types";
import type { Database } from "@/app/types/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { ChevronDown, Edit, Flag, MoreHorizontal, Trash2, UserRoundCog, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { formatDate } from "@/features/rentals/logic";
import {
  statusLabels,
  statusMeta,
} from "@/features/dashboard/leads/leadStatus";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { TemperatureBadge } from "@/features/dashboard/leads/TemperatureBadge";
import { LostReasonDialog } from "@/features/dashboard/leads/LostReasonDialog";
import type { LostReason } from "@/features/dashboard/leads/lostReasons";
import { DUE_PRESETS, NEXT_ACTION_PRESETS, nextActionState } from "@/features/dashboard/leads/followUp";

type LeadStatusValue = Database["public"]["Enums"]["lead_status"];

// Props que recibe el componente
type LeadTableProps = {
  initialLeads: LeadWithDetails[];
  userRole: string;
};

const NEXT_STYLE = { vencido: "text-danger", hoy: "text-warning", pendiente: "text-muted-foreground", sin_definir: "text-muted-foreground" } as const;

// Lista de leads con selección múltiple: cambiar estado, definir el próximo
// paso, reasignar (admin), descartar o eliminar varios a la vez.
export function LeadTable({ initialLeads, userRole }: LeadTableProps) {
  const supabase = createClientBrowser();
  const today = ymdInAppTz();
  const [leads, setLeads] = useState(initialLeads);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [toDelete, setToDelete] = useState<LeadWithDetails[]>([]);
  const [discarding, setDiscarding] = useState<LeadWithDetails[]>([]);
  const [nextOpen, setNextOpen] = useState(false);
  const [agents, setAgents] = useState<{ id: string; full_name: string }[] | null>(null);

  const isAdmin = userRole === "admin";
  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const allSelected = leads.length > 0 && selected.size === leads.length;

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Actualiza varios leads de una vez, con cambio optimista y vuelta atrás.
  const bulkUpdate = async (ids: string[], patch: Partial<Database["public"]["Tables"]["leads"]["Update"]>, message: string) => {
    if (!ids.length) return false;
    const before = leads;
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, ...patch } as LeadWithDetails : l)));
    const { error } = await supabase.from("leads").update(patch).in("id", ids);
    if (error) {
      toast.error(`No se pudo actualizar: ${error.message}`);
      setLeads(before);
      return false;
    }
    toast.success(message);
    return true;
  };

  const plural = (n: number) => (n === 1 ? "1 lead" : `${n} leads`);

  const handleStatusUpdate = async (
    targets: LeadWithDetails[],
    newStatus: LeadStatusValue,
    lost?: { reason: LostReason; note: string | null },
  ) => {
    // Descartar pide el motivo antes de tocar nada.
    if (newStatus === "DESCARTADO" && !lost) {
      setDiscarding(targets);
      return;
    }
    const lostFields = newStatus === "DESCARTADO" && lost ? { lost_reason: lost.reason, lost_reason_note: lost.note } : {};
    const ok = await bulkUpdate(targets.map((t) => t.id), { status: newStatus, ...lostFields },
      `${plural(targets.length)} → "${statusLabels[newStatus] || newStatus}"`);
    if (ok) setSelected(new Set());
  };

  const loadAgents = async () => {
    if (agents) return;
    const { data } = await supabase.from("agents").select("id, full_name").order("full_name");
    setAgents((data ?? []).map((a) => ({ id: a.id, full_name: a.full_name ?? "Sin nombre" })));
  };

  const reassign = async (agentId: string, name: string) => {
    const ids = selectedLeads.map((l) => l.id);
    const ok = await bulkUpdate(ids, { agent_id: agentId }, `${plural(ids.length)} reasignados a ${name}`);
    if (ok) {
      setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, agents: { ...(l.agents ?? {}), id: agentId, full_name: name } as LeadWithDetails["agents"] } : l)));
      setSelected(new Set());
    }
  };

  // --- Borrado (uno o varios) ---
  const handleDelete = async () => {
    if (!toDelete.length) return;
    setIsDeleting(true);
    const ids = toDelete.map((l) => l.id);
    const toastId = toast.loading(toDelete.length === 1 ? "Eliminando lead..." : `Eliminando ${toDelete.length} leads...`);
    const { error } = await supabase.from("leads").delete().in("id", ids);
    setIsDeleting(false);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`, { id: toastId });
    } else {
      toast.success(toDelete.length === 1 ? "Lead eliminado." : `${toDelete.length} leads eliminados.`, { id: toastId });
      setLeads((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    }
    setToDelete([]);
  };

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{plural(selected.size)} {selected.size === 1 ? "seleccionado" : "seleccionados"}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Edit className="size-4" /> Estado <ChevronDown className="size-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(statusLabels).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => handleStatusUpdate(selectedLeads, key as LeadStatusValue)}>{label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => setNextOpen(true)}><Flag className="size-4" /> Próximo paso</Button>
          {isAdmin && (
            <DropdownMenu onOpenChange={(open) => { if (open) void loadAgents(); }}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><UserRoundCog className="size-4" /> Reasignar <ChevronDown className="size-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {!agents && <DropdownMenuItem disabled>Cargando…</DropdownMenuItem>}
                {agents?.map((a) => <DropdownMenuItem key={a.id} onClick={() => reassign(a.id, a.full_name)}>{a.full_name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setToDelete(selectedLeads)}>
            <Trash2 className="size-4" /> Eliminar
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}><X className="size-4" /> Limpiar</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pr-0">
                <Checkbox checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) => setSelected(checked === true ? new Set(leads.map((l) => l.id)) : new Set())}
                  aria-label="Seleccionar todos" />
              </TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Próximo paso</TableHead>
              <TableHead className="hidden md:table-cell">
                Propiedad de interés
              </TableHead>
              <TableHead className="hidden xl:table-cell">Contacto</TableHead>
              {isAdmin && (
                <TableHead className="hidden lg:table-cell">
                  Responsable
                </TableHead>
              )}
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const meta = statusMeta(lead.status);
              const next = nextActionState(lead.next_action_at, today);

              return (
                <TableRow key={lead.id} className="group" data-state={selected.has(lead.id) ? "selected" : undefined}>
                  <TableCell className="pr-0">
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} aria-label={`Seleccionar ${lead.name}`} />
                  </TableCell>
                  <TableCell className="max-w-[220px] font-medium">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="block truncate text-foreground underline-offset-4 hover:underline"
                    >
                      {lead.name}
                    </Link>
                  </TableCell>

                  {/* Estado + temperatura (E1.8) */}
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusBadge tone={meta.tone} icon={meta.icon}>
                        {meta.label}
                      </StatusBadge>
                      <TemperatureBadge
                        status={lead.status}
                        lastActivityAt={lead.last_activity_at}
                        iconOnly
                      />
                    </span>
                  </TableCell>

                  <TableCell className="hidden max-w-[220px] lg:table-cell">
                    {lead.next_action ? (
                      <span className="block truncate text-sm">
                        {lead.next_action}
                        <span className={cn("block text-xs", NEXT_STYLE[next])}>
                          {next === "vencido" ? `Vencido ${formatDate(lead.next_action_at)}` : next === "hoy" ? "Hoy" : formatDate(lead.next_action_at)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin definir</span>
                    )}
                  </TableCell>

                  <TableCell className="hidden max-w-[260px] truncate text-fg-secondary md:table-cell">
                    {lead.properties ? (
                      <Link
                        href={`/dashboard/propiedades/${lead.properties.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {lead.properties.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        Sin propiedad
                      </span>
                    )}
                  </TableCell>

                  {/* Un solo dato de contacto por fila; el resto vive en el detalle */}
                  <TableCell className="hidden max-w-[220px] truncate text-fg-secondary xl:table-cell">
                    {lead.phone || lead.email || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {isAdmin && (
                    <TableCell className="hidden max-w-[160px] truncate text-fg-secondary lg:table-cell">
                      {lead.agents?.full_name ?? (
                        <span className="text-muted-foreground">
                          Sin asignar
                        </span>
                      )}
                    </TableCell>
                  )}

                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {format(new Date(lead.created_at), "d MMM yyyy", {
                      locale: es,
                    })}
                  </TableCell>

                  <TableCell className="py-0 pr-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Más acciones"
                          className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Edit />
                            <span>Cambiar estado</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              {Object.entries(statusLabels).map(
                                ([statusKey, statusLabel]) => (
                                  <DropdownMenuItem
                                    key={statusKey}
                                    onClick={() => handleStatusUpdate([lead], statusKey as LeadStatusValue)}
                                    disabled={lead.status === statusKey}
                                  >
                                    {statusLabel}
                                  </DropdownMenuItem>
                                ),
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setToDelete([lead])}
                        >
                          <Trash2 />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <BulkNextActionDialog
        open={nextOpen}
        count={selected.size}
        today={today}
        onOpenChange={setNextOpen}
        onConfirm={async (action, at) => {
          const ok = await bulkUpdate([...selected], { next_action: action, next_action_at: at },
            `Próximo paso definido para ${plural(selected.size)}`);
          if (ok) { setNextOpen(false); setSelected(new Set()); }
        }}
      />

      <LostReasonDialog
        leadName={discarding.length === 1 ? discarding[0].name : discarding.length > 1 ? `${discarding.length} leads` : null}
        open={discarding.length > 0}
        onOpenChange={(open) => {
          if (!open) setDiscarding([]);
        }}
        onConfirm={(reason, note) => {
          const targets = discarding;
          setDiscarding([]);
          if (targets.length) void handleStatusUpdate(targets, "DESCARTADO", { reason, note });
        }}
      />

      {/* Confirmación de borrado (uno o varios) */}
      <AlertDialog
        open={toDelete.length > 0}
        onOpenChange={() => setToDelete([])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete.length > 1 ? `Eliminar ${toDelete.length} leads` : "Eliminar lead"}</AlertDialogTitle>
            <AlertDialogDescription>
              Se {toDelete.length > 1 ? "eliminan" : "elimina"}{" "}
              <span className="font-medium text-foreground">
                {toDelete.length > 1 ? `${toDelete.length} leads` : toDelete[0]?.name}
              </span>{" "}
              con sus notas e historial. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Mismo próximo paso para varios leads (ej.: "Llamar" mañana a todos los fríos).
function BulkNextActionDialog({ open, count, today, onOpenChange, onConfirm }: {
  open: boolean; count: number; today: string; onOpenChange: (open: boolean) => void; onConfirm: (action: string, at: string) => Promise<void>;
}) {
  const [action, setAction] = useState("");
  const [at, setAt] = useState(addDays(today, 1));
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Próximo paso para {count === 1 ? "1 lead" : `${count} leads`}</DialogTitle>
          <DialogDescription>Reemplaza el próximo paso que tuvieran definido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Qué hay que hacer" aria-label="Próximo paso" maxLength={200} />
          <div className="flex flex-wrap gap-1.5">
            {NEXT_ACTION_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setAction(p)}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{p}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DUE_PRESETS.map((p) => {
              const value = addDays(today, p.days);
              return (
                <button key={p.label} type="button" onClick={() => setAt(value)} aria-pressed={at === value}
                  className={cn("rounded-md px-2 py-1 text-xs font-medium", at === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {p.label}
                </button>
              );
            })}
            <Input type="date" min={today} value={at} onChange={(e) => setAt(e.target.value)} className="h-8 w-auto text-xs" aria-label="Fecha" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy || action.trim().length < 2 || !at}
            onClick={async () => { setBusy(true); await onConfirm(action.trim(), at); setBusy(false); }}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
