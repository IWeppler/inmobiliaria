"use client";

import { useEffect, useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Bell, Check, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Badge } from "@/shared/components/ui/badge";

type Notification = {
  id: string;
  created_at: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  type?: string;
};

export function SidebarNotifications() {
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
          className="w-full justify-start text-zinc-700 hover:text-zinc-900 hover:bg-sidebar-accent relative py-1.5 h-auto cursor-pointer"
        >
          <Bell className="mr-1 h-5 w-5 text-zinc-700" />
          Notificaciones
          {unreadCount > 0 && (
            <Badge className="ml-auto bg-blue-600 hover:bg-blue-700 text-white py-0.5 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        className="w-80 p-0 shadow-lg border-zinc-200 rounded-xl"
        sideOffset={16}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">Notificaciones</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-zinc-200 text-zinc-700">
                {unreadCount} nuevas
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
            >
              <Check className="mr-1 h-3 w-3" /> Marcar leídas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[350px]">
          {notifications.length > 0 ? (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex flex-col gap-1 p-4 border-b border-zinc-100 last:border-0 transition-colors ${
                    notification.is_read
                      ? "bg-white opacity-70"
                      : "bg-blue-50/30"
                  }`}
                  onClick={() => {
                    if (!notification.is_read) markAsRead(notification.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {/* Puntito indicador de no leído */}
                        {!notification.is_read ? (
                          <div className="h-2 w-2 rounded-full bg-blue-600 mt-1.5" />
                        ) : (
                          <Info className="h-4 w-4 text-zinc-400 mt-0.5" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`text-sm ${notification.is_read ? "font-medium text-zinc-700" : "font-semibold text-zinc-900"}`}
                        >
                          {notification.title}
                        </span>
                        <span className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                          {notification.message}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pl-6">
                    <span className="text-[10px] font-medium text-zinc-400">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                    {notification.link && (
                      <Link
                        href={notification.link}
                        onClick={() => setIsOpen(false)}
                        className="text-[10px] font-semibold text-blue-600 hover:underline"
                      >
                        Ver detalles →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-zinc-400 gap-3">
              <Bell className="h-8 w-8 text-zinc-300" />
              <p className="text-sm">No tienes notificaciones.</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
