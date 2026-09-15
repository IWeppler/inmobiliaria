import {
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { ThemeBodyClass } from "@/features/theme/ThemeBodyClass";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ThemeBodyClass />
      <AppSidebar />
      <main className="flex-1 min-w-0 bg-background">
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
