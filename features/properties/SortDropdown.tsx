"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type SortDropdownProps = {
  currentSort: string;
};

export function SortDropdown({ currentSort }: SortDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "default") {
      params.delete("sortBy");
    } else {
      params.set("sortBy", value);
    }
    router.push(pathname + "?" + params.toString());
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-600">
        Ordenar por:
      </span>
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[180px] bg-white">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Más Recientes</SelectItem>
          <SelectItem value="price_asc">Más Barato</SelectItem>
          <SelectItem value="price_desc">Más Caro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}