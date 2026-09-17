"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  LogOut,
  Settings,
  Users,
  User as UserIcon,
  ChevronsUpDown,
  Building2,
  BarChart3,
  KeyRound,
  CalendarDays,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { createClientBrowser } from "@/lib/supabase-browser";

// Navegación = destinos. Las acciones ("Nueva propiedad") viven en el
// header de cada pantalla, no acá.
const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Propiedades", url: "/dashboard/propiedades", icon: Building2 },
  { title: "Leads", url: "/dashboard/leads", icon: Inbox },
  { title: "Agenda", url: "/dashboard/agenda", icon: CalendarDays },
  { title: "Alquileres", url: "/dashboard/alquileres", icon: KeyRound },
  { title: "Reportes", url: "/dashboard/reportes", icon: BarChart3 },
];

const adminNav = [
  { title: "Equipo", url: "/dashboard/agentes", icon: Users },
  { title: "Ajustes", url: "/dashboard/ajustes", icon: Settings },
];

// "/dashboard" es hoja; el resto marca activa toda su sección.
function isActivePath(pathname: string, url: string) {
  if (url === "/dashboard") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

type UserProfile = {
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
};

export function AppSidebar() {
  const router = useRouter();
  const supabase = createClientBrowser();
  const pathname = usePathname();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          const { data: agent } = await supabase
            .from("agents")
            .select("full_name, email, role, avatar_url")
            .eq("id", authUser.id)
            .single();

          if (agent) {
            setUser(agent);
          }
        }
      } catch (error) {
        console.error("Error user sidebar:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isAdmin = user?.role === "admin";

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

      {/* --- FOOTER (Usuario) --- */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {loading ? (
              <div className="flex items-center gap-2 p-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <Avatar className="size-8 rounded-md">
                      <AvatarImage
                        src={user?.avatar_url || ""}
                        alt={user?.full_name}
                      />
                      <AvatarFallback className="rounded-md text-xs font-medium">
                        {user?.full_name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.full_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8 rounded-md">
                        <AvatarImage
                          src={user?.avatar_url || ""}
                          alt={user?.full_name}
                        />
                        <AvatarFallback className="rounded-md text-xs font-medium">
                          {user?.full_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.full_name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.role === "admin" ? "Administrador" : "Agente"}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/perfil" className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Mi Perfil
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-danger focus:text-danger cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
