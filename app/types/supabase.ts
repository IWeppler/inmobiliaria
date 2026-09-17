export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      amenities: {
        Row: {
          icon_name: string | null
          id: number
          name: string | null
        }
        Insert: {
          icon_name?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          icon_name?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          agent_id: string | null
          created_at: string
          date: string
          id: string
          lead_id: string | null
          property_id: string | null
          time: string
          title: string
          type: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          date: string
          id?: string
          lead_id?: string | null
          property_id?: string | null
          time: string
          title: string
          type?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          date?: string
          id?: string
          lead_id?: string | null
          property_id?: string | null
          time?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          id: number
          usd_to_ars: number | null
        }
        Insert: {
          id: number
          usd_to_ars?: number | null
        }
        Update: {
          id?: number
          usd_to_ars?: number | null
        }
        Relationships: []
      }
      index_values: {
        Row: {
          created_at: string
          id: string
          index_code: string
          period: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          index_code: string
          period: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          index_code?: string
          period?: string
          value?: number
        }
        Relationships: []
      }
      lead_assignment_rules: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          match_type: string
          match_value: string
          priority: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          match_type: string
          match_value: string
          priority?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          match_type?: string
          match_value?: string
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_rules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          lead_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          property_id: string | null
          read_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          agent_id: string | null
          antiguedad: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          cocheras: string | null
          covered_area: number | null
          created_at: string
          currency: string | null
          description: string | null
          expensas: number | null
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          operation_type: string | null
          price: number | null
          price_normalized_ars: number | null
          property_type_id: number | null
          province: string | null
          rooms: number | null
          status: Database["public"]["Enums"]["property_status"]
          street_address: string | null
          title: string
          total_area: number | null
          views_count: number | null
        }
        Insert: {
          agent_id?: string | null
          antiguedad?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          cocheras?: string | null
          covered_area?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expensas?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          operation_type?: string | null
          price?: number | null
          price_normalized_ars?: number | null
          property_type_id?: number | null
          province?: string | null
          rooms?: number | null
          status: Database["public"]["Enums"]["property_status"]
          street_address?: string | null
          title: string
          total_area?: number | null
          views_count?: number | null
        }
        Update: {
          agent_id?: string | null
          antiguedad?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          cocheras?: string | null
          covered_area?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expensas?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          operation_type?: string | null
          price?: number | null
          price_normalized_ars?: number | null
          property_type_id?: number | null
          province?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          street_address?: string | null
          title?: string
          total_area?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          amenity_id: number
          property_id: string
        }
        Insert: {
          amenity_id: number
          property_id: string
        }
        Update: {
          amenity_id?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          id: string
          image_url: string | null
          order: number | null
          property_id: string | null
        }
        Insert: {
          id?: string
          image_url?: string | null
          order?: number | null
          property_id?: string | null
        }
        Update: {
          id?: string
          image_url?: string | null
          order?: number | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          created_at: string | null
          id: number
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      rental_contacts: {
        Row: {
          address: string | null
          created_at: string
          document: string | null
          email: string | null
          full_name: string
          id: string
          kind: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          full_name: string
          id?: string
          kind: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          kind?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      rental_contracts: {
        Row: {
          adjustment_index: string
          adjustment_months: number
          adjustment_pct: number | null
          agent_id: string | null
          base_period: string
          base_rent_amount: number
          commission_pct: number
          created_at: string
          currency: string
          end_date: string
          id: string
          late_fee_pct_daily: number
          next_adjustment_date: string | null
          notes: string | null
          owner_id: string
          payment_due_day: number
          property_id: string
          rent_amount: number
          start_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          adjustment_index?: string
          adjustment_months?: number
          adjustment_pct?: number | null
          agent_id?: string | null
          base_period: string
          base_rent_amount: number
          commission_pct?: number
          created_at?: string
          currency?: string
          end_date: string
          id?: string
          late_fee_pct_daily?: number
          next_adjustment_date?: string | null
          notes?: string | null
          owner_id: string
          payment_due_day?: number
          property_id: string
          rent_amount: number
          start_date: string
          status?: string
          tenant_id: string
        }
        Update: {
          adjustment_index?: string
          adjustment_months?: number
          adjustment_pct?: number | null
          agent_id?: string | null
          base_period?: string
          base_rent_amount?: number
          commission_pct?: number
          created_at?: string
          currency?: string
          end_date?: string
          id?: string
          late_fee_pct_daily?: number
          next_adjustment_date?: string | null
          notes?: string | null
          owner_id?: string
          payment_due_day?: number
          property_id?: string
          rent_amount?: number
          start_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_contracts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "rental_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "rental_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          method: string | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          period: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          period: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_settlements: {
        Row: {
          commission_amount: number
          contract_id: string
          created_at: string
          currency: string
          expenses: Json
          expenses_amount: number
          id: string
          issued_at: string
          net_amount: number
          notes: string | null
          period: string
          rent_amount: number
        }
        Insert: {
          commission_amount?: number
          contract_id: string
          created_at?: string
          currency?: string
          expenses?: Json
          expenses_amount?: number
          id?: string
          issued_at?: string
          net_amount: number
          notes?: string | null
          period: string
          rent_amount: number
        }
        Update: {
          commission_amount?: number
          contract_id?: string
          created_at?: string
          currency?: string
          expenses?: Json
          expenses_amount?: number
          id?: string
          issued_at?: string
          net_amount?: number
          notes?: string | null
          period?: string
          rent_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_settlements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_views: { Args: { property_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      next_agent_for_lead: {
        Args: { p_city?: string | null; p_property_type?: string | null }
        Returns: string
      }
      update_all_normalized_prices: {
        Args: { new_rate: number }
        Returns: undefined
      }
    }
    Enums: {
      lead_status:
        | "NUEVO"
        | "CONTACTADO"
        | "VISITA PROGRAMADA"
        | "NEGOCIACIÓN"
        | "CERRADO"
        | "DESCARTADO"
      property_status:
        | "EN_VENTA"
        | "EN_ALQUILER"
        | "RESERVADO"
        | "VENDIDO"
        | "ALQUILADO"
      property_type:
        | "CASA"
        | "DEPARTAMENTO"
        | "PH"
        | "TERRENO"
        | "LOCAL COMERCIAL"
        | "OFICINA COMERCIAL"
        | "CAMPO"
        | "GARAGE"
        | "FONDO DE COMERCIO"
        | "CONSULTORIO"
        | "OTRO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      lead_status: [
        "NUEVO",
        "CONTACTADO",
        "VISITA PROGRAMADA",
        "NEGOCIACIÓN",
        "CERRADO",
        "DESCARTADO",
      ],
      property_status: [
        "EN_VENTA",
        "EN_ALQUILER",
        "RESERVADO",
        "VENDIDO",
        "ALQUILADO",
      ],
      property_type: [
        "CASA",
        "DEPARTAMENTO",
        "PH",
        "TERRENO",
        "LOCAL COMERCIAL",
        "OFICINA COMERCIAL",
        "CAMPO",
        "GARAGE",
        "FONDO DE COMERCIO",
        "CONSULTORIO",
        "OTRO",
      ],
    },
  },
} as const
