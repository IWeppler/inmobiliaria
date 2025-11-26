export type Note = {
  id: string;
  created_at: string;
  content: string;
  user_id?: string;
};

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
  agent_id: string | null;

  properties: {
    id: string;
    title: string;
  } | null;

  agents: {
    full_name: string;
  } | null;

  lead_notes?: Note[];
};
