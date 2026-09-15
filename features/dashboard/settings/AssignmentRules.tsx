"use client";

import { useState } from "react";
import { Trash2, PlusCircle, MapPin, Home } from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export type AssignmentRule = {
  id: string;
  agent_id: string;
  match_type: string;
  match_value: string;
  priority: number;
  agents: { full_name: string | null } | null;
};

type Props = {
  initialRules: AssignmentRule[];
  agents: { id: string; full_name: string | null }[];
  cities: string[];
  propertyTypes: string[];
};

const MATCH_TYPES = [
  { value: "city", label: "Ciudad", icon: MapPin },
  { value: "property_type", label: "Tipo de propiedad", icon: Home },
] as const;

// E1.2 — Reglas de asignación automática. Solo admin (RLS). Se evalúan
// en next_agent_for_lead(): ciudad primero, después tipo de propiedad,
// después round-robin general.
export function AssignmentRules({
  initialRules,
  agents,
  cities,
  propertyTypes,
}: Props) {
  const supabase = createClientBrowser();
  const [rules, setRules] = useState(initialRules);
  const [agentId, setAgentId] = useState("");
  const [matchType, setMatchType] = useState<"city" | "property_type">("city");
  const [matchValue, setMatchValue] = useState("");
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);

  const suggestions = matchType === "city" ? cities : propertyTypes;

  const handleAdd = async () => {
    if (!agentId || !matchValue.trim()) {
      toast.error("Elegí un agente y un valor.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("lead_assignment_rules")
      .insert({
        agent_id: agentId,
        match_type: matchType,
        match_value: matchValue.trim(),
        priority,
      })
      .select("id, agent_id, match_type, match_value, priority, agents(full_name)")
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error(
        error?.code === "23505"
          ? "Esa regla ya existe para ese agente."
          : `Error al crear la regla: ${error?.message}`
      );
      return;
    }
    setRules((prev) =>
      [...prev, data as unknown as AssignmentRule].sort(
        (a, b) =>
          a.match_type.localeCompare(b.match_type) ||
          a.priority - b.priority ||
          a.match_value.localeCompare(b.match_value)
      )
    );
    setMatchValue("");
    toast.success("Regla creada.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("lead_assignment_rules")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">
          Reglas de asignación de leads
        </CardTitle>
        <CardDescription>
          Las consultas públicas se asignan primero por ciudad, después por
          tipo de propiedad, y si ninguna regla aplica, por turno entre todos
          los agentes. A menor prioridad, antes se evalúa. Las consultas por
          una propiedad con agente asignado siempre van a ese agente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_90px_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label>Agente</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name ?? a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Criterio</Label>
            <Select
              value={matchType}
              onValueChange={(v) => {
                setMatchType(v as "city" | "property_type");
                setMatchValue("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              list="assignment-rule-values"
              value={matchValue}
              onChange={(e) => setMatchValue(e.target.value)}
              placeholder={matchType === "city" ? "Ej: Rosario" : "Ej: Terreno"}
            />
            <datalist id="assignment-rule-values">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
            />
          </div>
          <Button onClick={handleAdd} disabled={saving} className="cursor-pointer">
            <PlusCircle className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Agregar"}
          </Button>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin reglas: todos los leads se reparten por turno.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {rules.map((r) => {
              const type = MATCH_TYPES.find((t) => t.value === r.match_type);
              const Icon = type?.icon ?? MapPin;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{type?.label}:</span>
                    <span className="font-medium truncate">{r.match_value}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="truncate">
                      {r.agents?.full_name ?? "Agente"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      (prioridad {r.priority})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(r.id)}
                    aria-label="Eliminar regla"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
