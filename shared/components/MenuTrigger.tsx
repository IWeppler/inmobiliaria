"use client";

import { Menu, PanelLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useSidebar } from "@/shared/components/ui/sidebar";

// En mobile abre el menú (hamburguesa); en desktop colapsa / expande el
// sidebar a íconos.
export function MenuTrigger() {
  const { toggleSidebar, isMobile, openMobile, open } = useSidebar();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-foreground"
      onClick={toggleSidebar}
      aria-label={isMobile ? "Abrir menú" : open ? "Colapsar menú" : "Expandir menú"}
      aria-expanded={isMobile ? openMobile : open}
    >
      <Menu className="size-5 md:hidden" />
      <PanelLeft className="hidden size-4 md:block" />
    </Button>
  );
}
