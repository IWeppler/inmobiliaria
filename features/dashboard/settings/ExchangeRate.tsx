"use client";

import { useActionState, useEffect } from "react";
import { updateRateAction } from "@/features/actions/updateRateActions";
import { toast } from "sonner";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";

type ExchangeRateManagerProps = {
  currentRate: number; // El valor actual, cargado desde el servidor
};

const initialState = { success: false, message: "" };

export function ExchangeRateManager({ currentRate }: ExchangeRateManagerProps) {
  const [formState, action] = useActionState(updateRateAction, initialState);

  useEffect(() => {
    if (formState.message) {
      if (formState.success) {
        toast.success(formState.message);
      } else {
        toast.error(formState.message);
      }
    }
  }, [formState]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-clash text-2xl">Gestionar Tasa de Cambio</CardTitle>
        <CardDescription>
          Actualiza el valor del USD a ARS. Esto recalculará los precios de
          todas las propiedades en USD para el ordenamiento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="exchange_rate" className="mb-2">
              1 USD = ARS
            </Label>
            <Input
              id="exchange_rate"
              name="exchange_rate"
              type="number"
              step="0.01"
              defaultValue={currentRate}
              placeholder="Ej: 1500"
              required
            />
          </div>
          <Button type="submit" className="w-full cursor-pointer">
            Actualizar Tasa y Recalcular Propiedades
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
