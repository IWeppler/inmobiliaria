export type LeadWithDetails = {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  notes: string | null;
  property_id: string | null;
  user_id: string;
  properties: {
    title: string;
  } | null;
};
