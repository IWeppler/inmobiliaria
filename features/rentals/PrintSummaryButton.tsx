"use client";

import { Printer } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export function PrintSummaryButton() {
  return <Button type="button" variant="outline" onClick={() => window.print()}><Printer /> Imprimir / guardar PDF</Button>;
}
