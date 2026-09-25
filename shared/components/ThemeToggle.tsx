"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/shared/components/ui/button";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return <Button
    type="button"
    variant="ghost"
    size="icon"
    className="size-8 text-muted-foreground hover:text-foreground"
    aria-label="Cambiar entre modo claro y oscuro"
    title="Cambiar entre modo claro y oscuro"
    onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
  >
    <Moon className="size-4 dark:hidden" />
    <Sun className="hidden size-4 dark:block" />
  </Button>;
}
