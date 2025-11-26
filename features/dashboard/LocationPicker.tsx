"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const defaultMarkerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Sub-componente para manejar clics en el mapa
function LocationMarker({ position, setPosition, onLocationChange }: any) {
  const map = useMap();

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationChange(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  // AQUÍ ESTABA EL ERROR: Ahora pasamos explícitamente la prop `icon`
  return position === null ? null : (
    <Marker position={position} icon={defaultMarkerIcon} />
  );
}

// Sub-componente para centrar el mapa cuando cambia la ciudad
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13); // Zoom 13 es un buen estándar
  }, [center, map]);
  return null;
}

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  cityCoordinates?: [number, number]; 
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  // Coordenadas por defecto (si fallan las de la ciudad, va a Santa Fe centro)
  cityCoordinates = [-31.6107, -60.6973], 
  onLocationSelect,
}: LocationPickerProps) {
  
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLat && initialLng ? new L.LatLng(initialLat, initialLng) : null
  );

  // Aseguramos que el centro del mapa sea válido
  const validCenter: [number, number] = 
    position ? [position.lat, position.lng] : cityCoordinates;

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-zinc-300 z-0 relative isolate">
      <MapContainer
        center={validCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <TileLayer
             attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
             url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
             opacity={0.4} 
        />

        <MapUpdater center={validCenter} />
        
        <LocationMarker
          position={position}
          setPosition={setPosition}
          onLocationChange={onLocationSelect}
        />
      </MapContainer>
      
      {/* Overlay de instrucciones */}
      <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-md text-xs font-medium z-500 shadow-md text-black pointer-events-none">
        Haz click para marcar la ubicación
      </div>
    </div>
  );
}