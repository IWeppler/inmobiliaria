import {
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { NotificationsMenu } from "@/shared/components/NotificationsMenu";
import { UserMenu } from "@/shared/components/UserMenu";
import { ThemeToggle } from "@/shared/components/ThemeToggle";

// Shell del panel: sidebar + topbar de 48px (colapsar sidebar a la
// izquierda, tema + notificaciones + usuario a la derecha) + contenido.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
          <SidebarTrigger
            className="text-muted-foreground hover:text-foreground"
            aria-label="Mostrar u ocultar menú"
          />
          <span className="text-sm font-semibold tracking-tight md:hidden">
            TerraNova
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SidebarProvider>
  );
}
