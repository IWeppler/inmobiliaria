"use client";

import { motion, useReducedMotion } from "framer-motion";

// Aparición al entrar en pantalla: acompaña la lectura sección por
// sección. Una sola vez por elemento; con "reducir movimiento" se
// muestra directo, sin animar.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      // Margen superior enorme: lo que ya quedó arriba del viewport cuenta
      // como visto. Evita secciones invisibles si se salta por encima de
      // ellas (tecla Fin, links a anclas, restauración del scroll).
      viewport={{ once: true, amount: 0.2, margin: "99999px 0px 0px 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
