"use client";

import {
  LayoutDashboard,
  PlusCircle,
  ListOrdered,
  LogOut,
  Tags,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/components/ui/sidebar";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Button } from "./ui/button";
import { useRouter, usePathname } from "next/navigation"; // Importa usePathname
import Link from "next/link"; // ¡Importa Link!

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Agregar Propiedad",
    url: "/dashboard/propiedades/nueva",
    icon: PlusCircle,
  },
  {
    title: "Gestión de Leads",
    url: "/dashboard/leads",
    icon: ListOrdered,
  },
  {
    title: "Ajustes",
    url: "/dashboard/ajustes",
    icon: Tags,
  },
];

export function AppSidebar() {
  const router = useRouter();
  const supabase = createClientBrowser();
  const pathname = usePathname();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Panel Inmobiliaria</SidebarGroupLabel>
          <SidebarGroupContent className="mb-2">
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      variant={isActive ? "outline" : "default"}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          {/* Botón de Cerrar Sesión (al final) */}
          <div className="mt-auto bottom-0 py-4 border-t">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-red-700 hover:text-red-500 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
