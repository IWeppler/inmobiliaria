"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";

const defaultMarkerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type LatLngTuple = [number, number];

// Marcador: click para colocar, arrastrar para ajustar (E2.3).
function LocationMarker({
  position,
  onChange,
}: {
  position: L.LatLng | null;
  onChange: (latlng: L.LatLng) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onChange(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker
      ref={markerRef}
      position={position}
      icon={defaultMarkerIcon}
      draggable
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) onChange(m.getLatLng());
        },
      }}
    />
  );
}

// Centra el mapa cuando cambia el destino (geocode / GPS), con el zoom
// que corresponda a la precisión: calle -> 16, ciudad -> 13, región -> 9.
function MapUpdater({ center, zoom }: { center: LatLngTuple; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [center, zoom, map]);
  return null;
}

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  cityCoordinates?: LatLngTuple;
  // Marcador controlado desde afuera (ej. geocode con precisión de calle).
  selected?: LatLngTuple | null;
  zoom?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  // Coordenadas por defecto (si fallan las de la ciudad, va a Santa Fe centro)
  cityCoordinates = [-31.6107, -60.6973],
  selected,
  zoom = 13,
  onLocationSelect,
}: LocationPickerProps) {
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLat && initialLng ? new L.LatLng(initialLat, initialLng) : null
  );
  const [locating, setLocating] = useState(false);

  // Sincroniza el marcador con `selected` (patrón "derivar estado durante
  // el render", sin efecto): solo cuando la prop cambia de valor.
  const [prevSelected, setPrevSelected] = useState(selected);
  if (
    selected?.[0] !== prevSelected?.[0] ||
    selected?.[1] !== prevSelected?.[1]
  ) {
    setPrevSelected(selected);
    if (selected) setPosition(new L.LatLng(selected[0], selected[1]));
  }

  // El centro sigue a cityCoordinates (geocode) o al marcador si existe.
  // Memoizado por valor: un array nuevo en cada render dispararía flyTo
  // en cada render.
  const [cityLat, cityLng] = cityCoordinates;
  const center = useMemo<LatLngTuple>(
    () => (position ? [position.lat, position.lng] : [cityLat, cityLng]),
    [position, cityLat, cityLng]
  );
  const effectiveZoom = position ? Math.max(zoom, 15) : zoom;

  const handleChange = (latlng: L.LatLng) => {
    setPosition(latlng);
    onLocationSelect(latlng.lat, latlng.lng);
  };

  // E2.3: el agente cargando la propiedad desde el lugar (campo, lote sin
  // calle) marca el punto con el GPS del teléfono.
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
        handleChange(latlng);
        setLocating(false);
        toast.success(
          `Ubicación marcada (precisión ±${Math.round(pos.coords.accuracy)} m).`
        );
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado."
            : "No se pudo obtener tu ubicación."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-zinc-300 z-0 relative isolate">
      <MapContainer
        center={center}
        zoom={effectiveZoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.4}
        />

        <MapUpdater center={center} zoom={effectiveZoom} />

        <LocationMarker position={position} onChange={handleChange} />
      </MapContainer>

      {/* Overlay de instrucciones */}
      <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-md text-xs font-medium z-500 shadow-md text-black pointer-events-none">
        {position
          ? "Arrastrá el marcador para ajustar"
          : "Hacé click para marcar la ubicación"}
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="absolute top-4 right-4 z-500 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-black shadow-md hover:bg-white disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <LocateFixed className="size-3.5" />
        )}
        Usar mi ubicación
      </button>

      {position && (
        <div className="absolute bottom-4 right-4 bg-white/90 px-2 py-1 rounded-md text-[11px] tabular-nums z-500 shadow-md text-zinc-700 pointer-events-none">
          {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}
