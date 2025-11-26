"use client";

import { useEffect } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

export function ViewCounter({ propertyId }: { propertyId: string }) {
  const supabase = createClientBrowser();

  useEffect(() => {
    const increment = async () => {
      await supabase.rpc("increment_views", { property_id: propertyId });
    };

    if (process.env.NODE_ENV === "production") {
      increment();
    } else {
      increment(); 
      console.log("ViewCounter: +1 (Simulado en Dev)");
    }
  }, [propertyId, supabase]);

  return null;
}