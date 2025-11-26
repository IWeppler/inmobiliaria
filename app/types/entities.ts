import type { Database } from "./supabase";

type Property = Database["public"]["Tables"]["properties"]["Row"];
type PropertyType = Database["public"]["Tables"]["property_types"]["Row"];
type PropertyImage = Database["public"]["Tables"]["property_images"]["Row"];

export type Agent = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type PropertyWithDetails = Property & {
  property_types: Pick<PropertyType, "name"> | null;
  property_images: Pick<PropertyImage, "image_url">[] | null;
  agent: Agent | null;
};

export type PropertyCardData = Pick<
  Property,
  | "id"
  | "title"
  | "price"
  | "currency"
  | "bedrooms"
  | "bathrooms"
  | "total_area"
  | "city"
  | "status"
  | "street_address"
> & {
  property_images: Pick<PropertyImage, "image_url">[] | null;
};
