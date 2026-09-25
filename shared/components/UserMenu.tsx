"use client";

import Link from "next/link";
import { ChevronDown, User as UserIcon } from "lucide-react";

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
import { useCurrentAgent } from "@/hooks/use-current-agent";

// Avatar + nombre en el topbar. Cerrar sesión vive en el footer del
// sidebar, acá solo perfil.
export function UserMenu() {
  const { agent, loading } = useCurrentAgent();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="hidden h-3 w-20 sm:block" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent data-[state=open]:bg-accent"
        >
          <Avatar className="size-7 rounded-md">
            <AvatarImage src={agent?.avatar_url || ""} alt={agent?.full_name} />
            <AvatarFallback className="rounded-md text-xs font-medium">
              {agent?.full_name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate font-medium sm:inline">
            {agent?.full_name}
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end" sideOffset={6}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-md">
              <AvatarImage src={agent?.avatar_url || ""} alt={agent?.full_name} />
              <AvatarFallback className="rounded-md text-xs font-medium">
                {agent?.full_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-semibold">{agent?.full_name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {agent?.role === "admin" ? "Administrador" : "Agente"}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
