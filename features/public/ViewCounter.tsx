"use client";

import { useEffect } from "react";
import { recordPropertyView } from "@/features/actions/recordPropertyView";

export function ViewCounter({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    recordPropertyView(propertyId).catch(() => {});
  }, [propertyId]);

  return null;
}
