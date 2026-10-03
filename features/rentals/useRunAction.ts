"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Ejecuta una server action con toast + refresh; `busy` guarda la clave de
// la acción en curso para deshabilitar botones y mostrar el spinner.
export function useRunAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ success: boolean; message: string }>) => {
    setBusy(key);
    try {
      const result = await fn();
      if (result.success) {
        if (result.message) toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
      return result.success;
    } catch {
      toast.error("No se pudo completar la operación.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { busy, run };
}
