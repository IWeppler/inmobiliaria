"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";

const TOP_ZONE = 80; // cerca del tope siempre visible
const THRESHOLD = 6; // px mínimos para considerar un cambio de dirección

// Navbar que se esconde al bajar y reaparece al subir. Usa el scroll de
// Motion (sin listener propio de "scroll") y solo cambia de estado
// cuando cambia la dirección, así no re-renderiza en cada frame.
export function useHideOnScroll() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (y < TOP_ZONE) setHidden(false);
    else if (y > prev + THRESHOLD) setHidden(true);
    else if (y < prev - THRESHOLD) setHidden(false);
  });

  return [hidden, setHidden] as const;
}
