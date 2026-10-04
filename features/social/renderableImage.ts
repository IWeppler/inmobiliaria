import "server-only";
import sharp from "sharp";

// Satori (next/og) solo dibuja PNG, JPEG y GIF: una foto WebP o AVIF se
// descarta en silencio y la pieza sale sin imagen. Acá se descarga la
// foto, se recorta al tamaño final y se pasa como JPEG en data URL, así
// funciona con cualquier formato y Satori no procesa fotos de 4000 px.
// Si la descarga o la conversión fallan devuelve null y la pieza se
// dibuja con el fondo de marca, igual que una propiedad sin fotos.
const FETCH_TIMEOUT_MS = 6000;

// fit "cover": recorta al tamaño exacto (la foto ocupa toda la pieza).
// fit "inside": solo limita el tamaño y deja que cada layout recorte.
export async function toRenderableImage(
  url: string | null, width: number, height: number, fit: "cover" | "inside" = "cover",
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate() // respeta la orientación EXIF de fotos de celular
      .resize(width, height, { fit, withoutEnlargement: fit === "inside" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}
