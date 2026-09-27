"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  LogOut,
  Settings,
  Users,
  Building2,
  BarChart3,
  KeyRound,
  CalendarDays,
  Wallet,
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
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from "@/shared/components/ui/sidebar";
import { createClientBrowser } from "@/lib/supabase-browser";
import { useCurrentAgent } from "@/hooks/use-current-agent";
import { GlobalSearch } from "@/shared/components/GlobalSearch";

// Navegación = destinos. Las acciones ("Nueva propiedad") viven en el
// header de cada pantalla, no acá.
const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Propiedades", url: "/dashboard/propiedades", icon: Building2 },
  { title: "Leads", url: "/dashboard/leads", icon: Inbox },
  { title: "Calendario", url: "/dashboard/calendario", icon: CalendarDays },
  { title: "Alquileres", url: "/dashboard/alquileres", icon: KeyRound },
  { title: "Reportes", url: "/dashboard/reportes", icon: BarChart3 },
];

const adminNav = [
  { title: "Finanzas", url: "/dashboard/finanzas", icon: Wallet },
  { title: "Equipo", url: "/dashboard/agentes", icon: Users },
  { title: "Ajustes", url: "/dashboard/ajustes", icon: Settings },
];

// "/dashboard" es hoja; el resto marca activa toda su sección.
function isActivePath(pathname: string, url: string) {
  if (url === "/dashboard") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar() {
  const router = useRouter();
  const supabase = createClientBrowser();
  const pathname = usePathname();

  const { agent, loading } = useCurrentAgent();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isAdmin = agent?.role === "admin";

  return (
    <Sidebar collapsible="icon">
      {/* --- HEADER  --- */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <span className="truncate text-base font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
                  TerraNova
                </span>
                <span className="hidden size-8 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background group-data-[collapsible=icon]:flex">
                  T
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* --- CONTENT  --- */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><GlobalSearch /></SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Grupo Principal */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const isActive = isActivePath(pathname, item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grupo Admin */}
        {!loading && isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => {
                  const isActive = isActivePath(pathname, item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* --- FOOTER (Cerrar sesión) --- */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Cerrar sesión"
              className="text-muted-foreground hover:text-danger"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
