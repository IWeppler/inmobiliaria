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
        className="h-10 w-[190px] gap-2 rounded-md border-border bg-card text-sm data-[size=default]:h-10"
      >
        <SelectValue placeholder="Ordenar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Más recientes
        </SelectItem>
        <SelectItem value="price_asc">
          <ArrowUpNarrowWide className="h-4 w-4 text-muted-foreground" />
          Menor precio
        </SelectItem>
        <SelectItem value="price_desc">
          <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
          Mayor precio
        </SelectItem>
      </SelectContent>
    </Select>
  );
}