// --- Tipos ---
export type Amenity = { amenities: { name: string } | null };
export type PropertyImage = { image_url: string | null };

export type PropertyFullDetails = {
  id: string;
  title: string;
  street_address: string | null;
  neighborhood: string | null;
  city: string | null;
  province: string | null;
  status: string;
  price: number | null;
  currency: string | null;
  operation_type: string; 
  property_types: { name: string } | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  total_area: number | null;
  covered_area: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  expensas: number | null;
  antiguedad: string | null;
  cocheras: number | null;
  property_images: PropertyImage[];
  property_amenities: Amenity[];
  agents: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};