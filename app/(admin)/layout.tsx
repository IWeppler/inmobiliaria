import {
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { AppBreadcrumbs } from "@/shared/components/AppBreadcrumbs";
import { NotificationsMenu } from "@/shared/components/NotificationsMenu";
import { UserMenu } from "@/shared/components/UserMenu";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { GoogleCalendarBanner } from "@/features/dashboard/google-calendar/GoogleCalendarBanner";

// Shell del panel: sidebar + topbar de 48px con ruta y acciones + contenido.
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
          <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          <AppBreadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>
        <GoogleCalendarBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SidebarProvider>
  );
}
