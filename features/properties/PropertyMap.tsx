import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type PropertyMapProps = {
  lat: number | null;
  lng: number | null;
  title: string;
};

export default function PropertyMap({ lat, lng, title }: PropertyMapProps) {
  // Evitar renderizar en SSR
  const isClient = typeof window !== "undefined";

  if (!isClient) {
    return (
      <div className="h-full w-full bg-zinc-200 flex items-center justify-center text-zinc-500">
        Cargando mapa...
      </div>
    );
  }

  if (typeof lat !== "number" || typeof lng !== "number") {
    return (
      <div className="h-full w-full bg-zinc-200 flex items-center justify-center text-zinc-500">
        Ubicación no disponible
      </div>
    );
  }

  // Ícono SVG inline (naranja estilo Lucide)
  const leafletIcon = L.divIcon({
    html: `
      <svg viewBox="0 0 24 24" width="36" height="36" xmlns="http://www.w3.org/2000/svg" fill="#f97316">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      </svg>
    `,
    className: "", // sin clase adicional
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });

  const position: [number, number] = [lat, lng];

  return (
    <MapContainer
      center={position}
      zoom={16}
      scrollWheelZoom={false}
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position} icon={leafletIcon}>
        <Popup>{title}</Popup>
      </Marker>
    </MapContainer>
  );
}
