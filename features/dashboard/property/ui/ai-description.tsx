"use client";

import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/shared/components/ui/form";

import type { PropertyFormValues } from "../PropertyForm";

interface AiDescriptionFieldProps {
  form: UseFormReturn<PropertyFormValues>;
}

export function AiDescriptionField({ form }: AiDescriptionFieldProps) {
  // Manejamos el estado de carga manualmente
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const currentData = form.getValues();

    if (!currentData.city || !currentData.title) {
      toast.error(
        "Ingresa al menos el Título y la Ciudad para darle contexto a la IA.",
      );
      return;
    }

    setIsLoading(true);
    form.setValue("description", "", {
      shouldValidate: true,
      shouldDirty: true,
    });

    try {
      // 1. Hacemos la petición manualmente a tu backend (/api/ai)
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: JSON.stringify(currentData) }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      // 2. LECTURA MANUAL DEL STREAM (A prueba de balas)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedText = "";

      if (reader) {
        while (true) {
          // Leemos cada pedacito de texto que va llegando de Gemini
          const { done, value } = await reader.read();
          if (done) break;

          // Decodificamos el texto y lo sumamos a lo que ya teníamos
          const chunk = decoder.decode(value, { stream: true });
          generatedText += chunk;

          // 3. Escribimos letra por letra en el formulario visualmente
          form.setValue("description", generatedText, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(
        "Ocurrió un error al contactar a la inteligencia artificial.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>Descripción Completa</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isLoading}
              className="h-8 text-indigo-600 border-indigo-200 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isLoading ? "Redactando..." : "Generar con IA"}
            </Button>
          </div>
          <FormControl>
            <Textarea
              placeholder="Detalles de la propiedad..."
              className="min-h-[200px] leading-relaxed resize-y"
              {...field}
              value={field.value || ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
