"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Clock } from "lucide-react";
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
    <Select value={currentSort} onValueChange={handleSortChange}>
      <SelectTrigger
        aria-label="Ordenar"
        className="h-10 w-[190px] gap-2 rounded-lg border-zinc-200 bg-white text-sm data-[size=default]:h-10"
      >
        <SelectValue placeholder="Ordenar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">
          <Clock className="h-4 w-4 text-zinc-400" />
          Más recientes
        </SelectItem>
        <SelectItem value="price_asc">
          <ArrowUpNarrowWide className="h-4 w-4 text-zinc-400" />
          Menor precio
        </SelectItem>
        <SelectItem value="price_desc">
          <ArrowDownWideNarrow className="h-4 w-4 text-zinc-400" />
          Mayor precio
        </SelectItem>
      </SelectContent>
    </Select>
  );
}