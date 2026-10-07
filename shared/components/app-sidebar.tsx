"use client";

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Inbox,
  Settings,
  Users,
  Building2,
  HousePlus,
  Handshake,
  BarChart3,
  KeyRound,
  CalendarDays,
  Wallet,
  ChevronsUpDown,
  LogOut,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createClientBrowser } from "@/lib/supabase-browser";
import { useCurrentAgent } from "@/hooks/use-current-agent";
import { GlobalSearch } from "@/shared/components/GlobalSearch";
import type { NavCounts } from "@/shared/components/navCounts";
import { roleLabel } from "@/features/tasks/rules";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  // Sección que marca activo el ítem, si difiere del destino.
  section?: string;
  access?: Access;
  count?: { key: keyof NavCounts; label: (n: number) => string; urgent?: boolean };
};

// Quién ve cada destino. "comercial": admin y agentes (administración no
// vende); "backOffice": admin y administración; "admin": solo admin. Sin
// access, todos.
type Access = "admin" | "backOffice" | "comercial";
const ACCESS: Record<Access, string[]> = {
  admin: ["admin"],
  backOffice: ["admin", "administracion"],
  comercial: ["admin", "agente"],
};

type NavGroup = { label: string | null; access?: Access; items: NavItem[] };

// Navegación = destinos, agrupados por área. Las acciones ("Nueva
// propiedad") viven en el header de cada pantalla, no acá.
const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      {
        // La bandeja del agente: ventas + alquileres, lo urgente primero.
        title: "Hoy", url: "/dashboard/hoy", icon: ListTodo,
        count: { key: "today", urgent: true, label: (n) => `${n} ${n === 1 ? "tarea urgente" : "tareas urgentes"} para hoy` },
      },
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, access: "comercial" },
    ],
  },
  {
    label: "Comercial",
    access: "comercial",
    items: [
      // En el orden del negocio: captar, publicar, vender, escriturar.
      { title: "Captaciones", url: "/dashboard/captaciones", icon: HousePlus },
      { title: "Propiedades", url: "/dashboard/propiedades", icon: Building2 },
      {
        title: "Leads", url: "/dashboard/leads", icon: Inbox,
        count: { key: "leads", label: (n) => `${n} ${n === 1 ? "lead nuevo" : "leads nuevos"} sin contactar` },
      },
      { title: "Operaciones", url: "/dashboard/operaciones", icon: Handshake },
      { title: "Calendario", url: "/dashboard/calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        // Entra por la bandeja Hoy: lo primero es qué hay que hacer.
        title: "Alquileres", url: "/dashboard/alquileres/hoy", section: "/dashboard/alquileres", icon: KeyRound,
        count: { key: "rentals", urgent: true, label: (n) => `${n} ${n === 1 ? "tarea urgente" : "tareas urgentes"} en alquileres` },
      },
    ],
  },
  {
    label: "Análisis",
    items: [
      { title: "Reportes", url: "/dashboard/reportes", icon: BarChart3, access: "comercial" },
      { title: "Finanzas", url: "/dashboard/finanzas", icon: Wallet, access: "backOffice" },
    ],
  },
  {
    label: "Administración",
    access: "admin",
    items: [
      { title: "Equipo", url: "/dashboard/agentes", icon: Users },
      { title: "Ajustes", url: "/dashboard/ajustes", icon: Settings },
    ],
  },
];

// "/dashboard" es hoja; el resto marca activa toda su sección.
function isActivePath(pathname: string, url: string) {
  if (url === "/dashboard") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar({ counts }: { counts: Promise<NavCounts> }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { agent, loading } = useCurrentAgent();
  // Mientras carga el rol se muestra lo de un agente (el caso más común),
  // sin los ítems restringidos.
  const allowed = (access?: Access) =>
    !access || (loading ? access === "comercial" : ACCESS[access].includes(agent?.role ?? "agente"));

  // En mobile el menú es un panel superpuesto: se cierra al navegar.
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  const groups = NAV
    .filter((g) => allowed(g.access))
    .map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.access)) }))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="TerraNova">
              <Link href="/dashboard">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
                  T
                </span>
                <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-semibold tracking-tight text-foreground">TerraNova</span>
                  <span className="truncate text-xs text-muted-foreground">Panel de gestión</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem><GlobalSearch /></SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((group) => (
          <SidebarGroup key={group.label ?? "inicio"} className="py-1.5">
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.title} item={item} active={isActivePath(pathname, item.section ?? item.url)} counts={counts} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({ item, active, counts }: { item: NavItem; active: boolean; counts: Promise<NavCounts> }) {
  return (
    <SidebarMenuItem>
      {/* Marca del ítem activo, pegada al borde del sidebar. */}
      {active && (
        <span aria-hidden className="pointer-events-none absolute inset-y-1.5 -left-2 w-[3px] rounded-r-full bg-sidebar-primary" />
      )}
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className="text-sidebar-foreground data-[active=true]:shadow-none [&>svg]:stroke-[1.75] data-[active=true]:[&>svg]:text-sidebar-primary"
      >
        <Link href={item.url}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {item.count && (
        <Suspense fallback={null}>
          <CountBadge counts={counts} item={item} />
        </Suspense>
      )}
    </SidebarMenuItem>
  );
}

// Contador a la derecha del ítem; con el sidebar colapsado queda un punto
// sobre el ícono. Si es 0 no se muestra nada.
function CountBadge({ counts, item }: { counts: Promise<NavCounts>; item: NavItem }) {
  const n = use(counts)[item.count!.key];
  if (!n) return null;
  const label = item.count!.label(n);
  return (
    <>
      <SidebarMenuBadge
        aria-label={label}
        title={label}
        className={cn(
          "bg-sidebar-accent",
          item.count!.urgent ? "text-danger peer-data-[active=true]/menu-button:text-danger" : "text-sidebar-foreground",
        )}
      >
        {n > 99 ? "99+" : n}
      </SidebarMenuBadge>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1.5 left-6 hidden size-2 rounded-full ring-2 ring-sidebar group-data-[collapsible=icon]:block",
          item.count!.urgent ? "bg-danger" : "bg-foreground/60",
        )}
      />
    </>
  );
}

// Agente logueado al pie: perfil y cerrar sesión, dentro de un menú para que
// salir nunca quede a un clic accidental.
function SidebarUser() {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { agent, loading } = useCurrentAgent();

  const logout = async () => {
    await createClientBrowser().auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex h-12 items-center gap-2 px-2">
        <Skeleton className="size-8 rounded-md" />
        <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    );
  }

  const name = agent?.full_name ?? "Usuario";
  const role = roleLabel(agent?.role);
  const avatar = (
    <Avatar className="size-8 rounded-md">
      <AvatarImage src={agent?.avatar_url || ""} alt="" />
      <AvatarFallback className="rounded-md text-xs font-medium">{name[0]}</AvatarFallback>
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={name} className="data-[state=open]:bg-sidebar-accent">
              {avatar}
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium text-foreground">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{role}</span>
              </span>
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? "top" : "right"} align="end" sideOffset={8}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
                {avatar}
                <div className="grid min-w-0 leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{agent?.email ?? role}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/perfil" className="cursor-pointer">
                <UserIcon /> Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="cursor-pointer text-muted-foreground focus:text-danger">
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
