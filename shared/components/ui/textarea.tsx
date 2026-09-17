import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-card px-2.5 py-2 text-sm text-foreground transition-[border-color,box-shadow] duration-150 outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
