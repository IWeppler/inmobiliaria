import localFont from "next/font/local";

// Tipografía del sitio público, self-hosted (Fontshare Free License).
// Solo se importa desde el layout público, así el panel no las precarga.
export const generalSans = localFont({
  src: [
    { path: "./site/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "./site/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "./site/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "./site/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

// Las fuentes se exponen en `body:has(.site-public)` (y no solo en el
// wrapper) para que también las hereden los portales de Radix (selects,
// popovers, menús) que se montan directo en <body>. Se inyecta con un
// <style> desde cada layout del sitio público.
export function siteFontVars() {
  return `body:has(.site-public){--site-font-body:${generalSans.style.fontFamily};--site-font-display:${clashGrotesk.style.fontFamily};}`;
}

export const clashGrotesk = localFont({
  src: [
    { path: "./site/ClashGrotesk-500.woff2", weight: "500", style: "normal" },
    { path: "./site/ClashGrotesk-600.woff2", weight: "600", style: "normal" },
    { path: "./site/ClashGrotesk-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
