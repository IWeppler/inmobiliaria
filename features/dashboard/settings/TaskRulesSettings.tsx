"use client";

import { useState } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/lib/utils";
import { useRunAction } from "@/features/rentals/useRunAction";
import { updateTaskRuleAction } from "@/features/tasks/actions";
import { PRIORITY_LABELS, roleLabel, type TaskPriority } from "@/features/tasks/rules";

export type TaskRuleRow = {
  key: string; label: string; description: string | null; enabled: boolean;
  assignee_id: string | null; due_days: number; priority: string;
};

const PROPERTY_AGENT = "__agente__";

// El playbook del motor de tareas: qué se genera cuando se publica una
// propiedad, para quién y en cuántos días. Cada cambio se guarda al toque y
// rige para las próximas publicaciones (no toca las tareas ya creadas).
export function TaskRulesSettings({ rules, agents }: {
  rules: TaskRuleRow[];
  agents: { id: string; full_name: string | null; role: string | null }[];
}) {
  const { busy, run } = useRunAction();
  const [days, setDays] = useState<Record<string, string>>(Object.fromEntries(rules.map((r) => [r.key, String(r.due_days)])));

  const save = (rule: TaskRuleRow, patch: Partial<TaskRuleRow>) => {
    const next = { ...rule, ...patch };
    return run(`rule-${rule.key}`, () => updateTaskRuleAction({
      key: next.key, enabled: next.enabled, assignee_id: next.assignee_id, due_days: next.due_days, priority: next.priority as TaskPriority,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas automáticas</CardTitle>
        <CardDescription>
          Cuando una propiedad se publica (en venta o en alquiler) se crean estas tareas. Si se reserva, vende o alquila,
          las pendientes se cancelan solas. Los cambios rigen para las próximas publicaciones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border-subtle">
          {rules.map((rule) => (
            <li key={rule.key} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <label className="flex items-start gap-3">
                <Checkbox className="mt-0.5" checked={rule.enabled} disabled={!!busy}
                  onCheckedChange={(v) => save(rule, { enabled: v === true })} aria-label={`Activar: ${rule.label}`} />
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", !rule.enabled && "text-muted-foreground")}>{rule.label}</span>
                  {rule.description && <span className="block text-xs text-muted-foreground">{rule.description}</span>}
                </span>
              </label>
              <div className={cn("flex flex-wrap items-center gap-2 pl-7 md:pl-0", !rule.enabled && "opacity-50")}>
                <Select value={rule.assignee_id ?? PROPERTY_AGENT} disabled={!rule.enabled || !!busy}
                  onValueChange={(v) => save(rule, { assignee_id: v === PROPERTY_AGENT ? null : v })}>
                  <SelectTrigger className="h-8 w-48" aria-label="Responsable"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROPERTY_AGENT}>Agente de la propiedad</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name ?? "Sin nombre"} <span className="text-muted-foreground">· {roleLabel(a.role)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  en
                  <Input type="number" min={0} max={60} className="h-8 w-16" value={days[rule.key]} disabled={!rule.enabled || !!busy}
                    onChange={(e) => setDays((d) => ({ ...d, [rule.key]: e.target.value }))}
                    onBlur={() => {
                      const n = Number(days[rule.key]);
                      if (Number.isInteger(n) && n >= 0 && n <= 60 && n !== rule.due_days) void save(rule, { due_days: n });
                      else setDays((d) => ({ ...d, [rule.key]: String(rule.due_days) }));
                    }} aria-label="Días para el vencimiento" />
                  días
                </label>
                <Select value={rule.priority} disabled={!rule.enabled || !!busy} onValueChange={(v) => save(rule, { priority: v })}>
                  <SelectTrigger className="h-8 w-24" aria-label="Prioridad"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["alta", "media", "baja"] as TaskPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
