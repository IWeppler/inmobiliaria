import { SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { SectionSidebar } from "@/shared/components/SectionSidebar";
import { MenuTrigger } from "@/shared/components/MenuTrigger";
import { getNavCounts } from "@/shared/components/navCounts";
import { AppBreadcrumbs } from "@/shared/components/AppBreadcrumbs";
import { NotificationsMenu } from "@/shared/components/NotificationsMenu";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { GoogleCalendarBanner } from "@/features/dashboard/google-calendar/GoogleCalendarBanner";

// Shell del panel: sidebar principal + panel de sección (si el módulo lo
// tiene) + topbar de 48px con ruta y acciones + contenido. El usuario vive
// al pie del sidebar.
export default function Layout({ children }: { children: React.ReactNode }) {
  // Sin await: los contadores llegan por streaming y no frenan el panel.
  const counts = getNavCounts();
  return (
    <SidebarProvider>
      <AppSidebar counts={counts} />
      <SectionSidebar counts={counts} />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
          <MenuTrigger />
          <span className="hidden h-4 w-px shrink-0 bg-border md:block" aria-hidden="true" />
          <AppBreadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationsMenu />
          </div>
        </header>
        <GoogleCalendarBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SidebarProvider>
  );
}
