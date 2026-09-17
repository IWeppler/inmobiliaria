"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { createClientBrowser } from "@/lib/supabase-browser";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  created_at: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  type?: string;
};

// Campana del topbar. Un punto de acento cuando hay no leídas; el listado
// es plano (sin fondos por estado): lo no leído se distingue por peso.
export function NotificationsMenu() {
  const supabase = createClientBrowser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setNotifications(data);
    };

    fetchNotifications();

    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notificaciones, ${unreadCount} sin leer`
              : "Notificaciones"
          }
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-card"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex h-10 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-medium">
            Notificaciones
            {unreadCount > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {unreadCount} sin leer
              </span>
            )}
          </span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check /> Marcar leídas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[360px]">
          {notifications.length > 0 ? (
            <ul className="divide-y divide-border-subtle">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-2.5 px-3 py-2.5",
                    !n.is_read && "cursor-pointer hover:bg-muted/40",
                  )}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                  }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      n.is_read ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        n.is_read
                          ? "text-fg-secondary"
                          : "font-medium text-foreground",
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => setIsOpen(false)}
                          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Ver
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No tenés notificaciones.
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
