import type { Database } from "@/app/types/supabase";

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type AgentRow = Database["public"]["Tables"]["agents"]["Row"];

// --- Tipos ---
export type Amenity = { amenities: { name: string } | null };
export type PropertyImage = { image_url: string | null };

export type PropertyFullDetails = Pick<
  PropertyRow,
  | "id"
  | "title"
  | "street_address"
  | "neighborhood"
  | "city"
  | "province"
  | "status"
  | "price"
  | "currency"
  | "operation_type"
  | "bedrooms"
  | "bathrooms"
  | "rooms"
  | "total_area"
  | "covered_area"
  | "description"
  | "latitude"
  | "longitude"
  | "expensas"
  | "antiguedad"
  | "cocheras"
> & {
  property_types: { name: string } | null;
  property_images: PropertyImage[];
  property_amenities: Amenity[];
  agents: Pick<
    AgentRow,
    "id" | "full_name" | "avatar_url" | "phone" | "email"
  > | null;
};