"use client";

import { useEffect, useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

export type CurrentAgent = {
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
};

// Perfil del agente logueado (tabla `agents`). Lo usan el sidebar (rol
// para el grupo admin) y el menú de usuario del topbar.
export function useCurrentAgent() {
  const supabase = createClientBrowser();
  const [agent, setAgent] = useState<CurrentAgent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          const { data } = await supabase
            .from("agents")
            .select("full_name, email, role, avatar_url")
            .eq("id", authUser.id)
            .single();
          if (data) setAgent(data);
        }
      } catch (error) {
        console.error("Error current agent:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgent();
  }, [supabase]);

  return { agent, loading };
}
