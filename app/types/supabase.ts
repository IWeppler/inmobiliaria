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
      lead_source_costs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          month: string
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          month: string
          source: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          month?: string
          source?: string
        }
        Relationships: []
      }
      property_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          currency: string | null
          id: string
          price: number
          property_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          currency?: string | null
          id?: string
          price: number
          property_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          currency?: string | null
          id?: string
          price?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_views_daily: {
        Row: {
          day: string
          property_id: string
          views: number
        }
        Insert: {
          day: string
          property_id: string
          views?: number
        }
        Update: {
          day?: string
          property_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_views_daily_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          outcome: string
          property_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          outcome: string
          property_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          outcome?: string
          property_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cash_movements: {
        Row: { id: string; occurred_on: string; direction: string; category: string; nature: string | null; description: string; amount: number; currency: string; property_id: string | null; contract_id: string | null; settlement_id: string | null; maintenance_id: string | null; sale_id: string | null; recurring_expense_id: string | null; recurring_period: string | null; agent_id: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; occurred_on: string; direction: string; category: string; nature?: string | null; description: string; amount: number; currency: string; property_id?: string | null; contract_id?: string | null; settlement_id?: string | null; maintenance_id?: string | null; sale_id?: string | null; recurring_expense_id?: string | null; recurring_period?: string | null; agent_id?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; occurred_on?: string; direction?: string; category?: string; nature?: string | null; description?: string; amount?: number; currency?: string; property_id?: string | null; contract_id?: string | null; settlement_id?: string | null; maintenance_id?: string | null; sale_id?: string | null; recurring_expense_id?: string | null; recurring_period?: string | null; agent_id?: string | null; created_by?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "cash_movements_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_movements_contract_id_fkey"; columns: ["contract_id"]; isOneToOne: false; referencedRelation: "rental_contracts"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_movements_settlement_id_fkey"; columns: ["settlement_id"]; isOneToOne: true; referencedRelation: "rental_settlements"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_movements_sale_id_fkey"; columns: ["sale_id"]; isOneToOne: false; referencedRelation: "property_sales"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_movements_recurring_expense_id_fkey"; columns: ["recurring_expense_id"]; isOneToOne: false; referencedRelation: "recurring_expenses"; referencedColumns: ["id"] },
          { foreignKeyName: "cash_movements_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
        ]
      }
      events: {
        Row: {
          agent_id: string | null
          created_at: string
          date: string
          google_event_id: string | null
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
          google_event_id?: string | null
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
          google_event_id?: string | null
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
      google_calendar_connections: {
        Row: {
          agent_id: string
          access_token: string | null
          access_token_expires_at: string | null
          calendar_id: string
          created_at: string
          google_email: string | null
          last_error: string | null
          refresh_token: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          access_token?: string | null
          access_token_expires_at?: string | null
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          last_error?: string | null
          refresh_token: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          access_token?: string | null
          access_token_expires_at?: string | null
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          last_error?: string | null
          refresh_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
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
          source: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          index_code: string
          period: string
          source?: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          index_code?: string
          period?: string
          source?: string
          updated_at?: string
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
          lost_reason: string | null
          lost_reason_note: string | null
          name: string
          notes: string | null
          phone: string | null
          property_id: string | null
          read_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          search_bathrooms_min: number | null
          search_bedrooms_min: number | null
          search_budget_max: number | null
          search_budget_min: number | null
          search_confirmed_at: string | null
          search_currency: string | null
          search_financing: boolean | null
          search_locations: string[]
          search_operation: string | null
          search_type_ids: number[]
          search_urgency: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lost_reason?: string | null
          lost_reason_note?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          search_bathrooms_min?: number | null
          search_bedrooms_min?: number | null
          search_budget_max?: number | null
          search_budget_min?: number | null
          search_confirmed_at?: string | null
          search_currency?: string | null
          search_financing?: boolean | null
          search_locations?: string[]
          search_operation?: string | null
          search_type_ids?: number[]
          search_urgency?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lost_reason?: string | null
          lost_reason_note?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          search_bathrooms_min?: number | null
          search_bedrooms_min?: number | null
          search_budget_max?: number | null
          search_budget_min?: number | null
          search_confirmed_at?: string | null
          search_currency?: string | null
          search_financing?: boolean | null
          search_locations?: string[]
          search_operation?: string | null
          search_type_ids?: number[]
          search_urgency?: string | null
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
      property_owners: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          property_id: string
          share_pct: number
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          property_id: string
          share_pct: number
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          property_id?: string
          share_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rental_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          agent_id: string | null
          captured_by: string | null
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
          captured_by?: string | null
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
          captured_by?: string | null
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
      property_sales: {
        Row: { id: string; property_id: string; sold_on: string; sale_price: number; currency: string; commission_pct: number; commission_amount: number; agent_id: string | null; agent_commission_pct: number; agent_commission_amount: number; notes: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; property_id: string; sold_on: string; sale_price: number; currency: string; commission_pct: number; commission_amount: number; agent_id?: string | null; agent_commission_pct?: number; agent_commission_amount?: number; notes?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; property_id?: string; sold_on?: string; sale_price?: number; currency?: string; commission_pct?: number; commission_amount?: number; agent_id?: string | null; agent_commission_pct?: number; agent_commission_amount?: number; notes?: string | null; created_by?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "property_sales_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "property_sales_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
        ]
      }
      recurring_expenses: {
        Row: { id: string; description: string; category: string; amount: number; currency: string; day_of_month: number; start_period: string; active: boolean; created_by: string | null; created_at: string }
        Insert: { id?: string; description: string; category: string; amount: number; currency: string; day_of_month?: number; start_period: string; active?: boolean; created_by?: string | null; created_at?: string }
        Update: { id?: string; description?: string; category?: string; amount?: number; currency?: string; day_of_month?: number; start_period?: string; active?: boolean; created_by?: string | null; created_at?: string }
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
      rental_adjustments: {
        Row: { id: string; contract_id: string; effective_date: string; previous_amount: number; new_amount: number; factor: number | null; index_code: string; applied_at: string }
        Insert: { id?: string; contract_id: string; effective_date: string; previous_amount: number; new_amount: number; factor?: number | null; index_code: string; applied_at?: string }
        Update: { id?: string; contract_id?: string; effective_date?: string; previous_amount?: number; new_amount?: number; factor?: number | null; index_code?: string; applied_at?: string }
        Relationships: [{ foreignKeyName: "rental_adjustments_contract_id_fkey"; columns: ["contract_id"]; isOneToOne: false; referencedRelation: "rental_contracts"; referencedColumns: ["id"] }]
      }
      rental_charges: {
        Row: { id: string; contract_id: string; rent_payment_id: string | null; period: string; due_date: string; kind: string; description: string; amount: number; currency: string; created_at: string; late_fee_of: string | null }
        Insert: { id?: string; contract_id: string; rent_payment_id?: string | null; period: string; due_date: string; kind: string; description: string; amount: number; currency: string; created_at?: string; late_fee_of?: string | null }
        Update: { id?: string; contract_id?: string; rent_payment_id?: string | null; period?: string; due_date?: string; kind?: string; description?: string; amount?: number; currency?: string; created_at?: string; late_fee_of?: string | null }
        Relationships: [
          { foreignKeyName: "rental_charges_contract_id_fkey"; columns: ["contract_id"]; isOneToOne: false; referencedRelation: "rental_contracts"; referencedColumns: ["id"] },
          { foreignKeyName: "rental_charges_rent_payment_id_fkey"; columns: ["rent_payment_id"]; isOneToOne: true; referencedRelation: "rental_payments"; referencedColumns: ["id"] },
        ]
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
          deposit_amount: number
          deposit_deductions: Json
          deposit_received_at: string | null
          deposit_returned_amount: number | null
          deposit_returned_at: string | null
          end_date: string
          guarantee_detail: string | null
          guarantee_type: string
          index_lag_months: number
          id: string
          last_adjustment_date: string | null
          late_fee_fixed: number
          late_fee_grace_days: number
          late_fee_mode: string
          late_fee_pct_daily: number
          next_adjustment_date: string | null
          notes: string | null
          owner_id: string
          payment_due_day: number
          property_id: string
          renewed_from_id: string | null
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
          deposit_amount?: number
          deposit_deductions?: Json
          deposit_received_at?: string | null
          deposit_returned_amount?: number | null
          deposit_returned_at?: string | null
          end_date: string
          guarantee_detail?: string | null
          guarantee_type?: string
          index_lag_months?: number
          id?: string
          last_adjustment_date?: string | null
          late_fee_fixed?: number
          late_fee_grace_days?: number
          late_fee_mode?: string
          late_fee_pct_daily?: number
          next_adjustment_date?: string | null
          notes?: string | null
          owner_id: string
          payment_due_day?: number
          property_id: string
          renewed_from_id?: string | null
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
          deposit_amount?: number
          deposit_deductions?: Json
          deposit_received_at?: string | null
          deposit_returned_amount?: number | null
          deposit_returned_at?: string | null
          end_date?: string
          guarantee_detail?: string | null
          guarantee_type?: string
          index_lag_months?: number
          id?: string
          last_adjustment_date?: string | null
          late_fee_fixed?: number
          late_fee_grace_days?: number
          late_fee_mode?: string
          late_fee_pct_daily?: number
          next_adjustment_date?: string | null
          notes?: string | null
          owner_id?: string
          payment_due_day?: number
          property_id?: string
          renewed_from_id?: string | null
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
            foreignKeyName: "rental_contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
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
      rental_contract_parties: {
        Row: {
          contact_id: string
          contract_id: string
          created_at: string
          id: string
          notes: string | null
          role: string
          share_pct: number | null
        }
        Insert: {
          contact_id: string
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role: string
          share_pct?: number | null
        }
        Update: {
          contact_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: string
          share_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_contract_parties_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rental_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contract_parties_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_documents: {
        Row: {
          contract_id: string
          created_at: string
          file_name: string
          id: string
          kind: string
          path: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          file_name: string
          id?: string
          kind: string
          path: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_maintenance: {
        Row: {
          charge_id: string | null
          contract_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          id: string
          payer: string | null
          priority: string
          provider: string | null
          reported_at: string
          resolved_at: string | null
          settlement_id: string | null
          status: string
          title: string
        }
        Insert: {
          charge_id?: string | null
          contract_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          payer?: string | null
          priority?: string
          provider?: string | null
          reported_at?: string
          resolved_at?: string | null
          settlement_id?: string | null
          status?: string
          title: string
        }
        Update: {
          charge_id?: string | null
          contract_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          payer?: string | null
          priority?: string
          provider?: string | null
          reported_at?: string
          resolved_at?: string | null
          settlement_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_maintenance_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "rental_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_maintenance_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "rental_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_maintenance_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "rental_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_payment_entries: {
        Row: { id: string; charge_id: string; paid_at: string; amount: number; method: string; account: string | null; notes: string | null; receipt_number: number; created_at: string; bank_movement_id: string | null }
        Insert: { id?: string; charge_id: string; paid_at: string; amount: number; method: string; account?: string | null; notes?: string | null; created_at?: string; bank_movement_id?: string | null }
        Update: { id?: string; charge_id?: string; paid_at?: string; amount?: number; method?: string; account?: string | null; notes?: string | null; created_at?: string; bank_movement_id?: string | null }
        Relationships: [{ foreignKeyName: "rental_payment_entries_charge_id_fkey"; columns: ["charge_id"]; isOneToOne: false; referencedRelation: "rental_charges"; referencedColumns: ["id"] }]
      }
      rental_contract_templates: {
        Row: { id: string; name: string; body: string; is_default: boolean; updated_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; body: string; is_default?: boolean; updated_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; body?: string; is_default?: boolean; updated_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      rental_bank_movements: {
        Row: {
          id: string; hash: string; movement_date: string; description: string; amount: number; currency: string
          account: string; status: string; contract_id: string | null; created_by: string; created_at: string
        }
        Insert: {
          id?: string; hash: string; movement_date: string; description: string; amount: number; currency: string
          account: string; status: string; contract_id?: string | null; created_by?: string; created_at?: string
        }
        Update: {
          id?: string; hash?: string; movement_date?: string; description?: string; amount?: number; currency?: string
          account?: string; status?: string; contract_id?: string | null; created_by?: string; created_at?: string
        }
        Relationships: [{ foreignKeyName: "rental_bank_movements_contract_id_fkey"; columns: ["contract_id"]; isOneToOne: false; referencedRelation: "rental_contracts"; referencedColumns: ["id"] }]
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
      rental_settings: {
        Row: {
          id: number; expiry_alert_days: number; adjustment_alert_days: number; updated_at: string
          notify_receipts: boolean; notify_adjustments: boolean; notify_due: boolean; notify_overdue: boolean
          adjustment_notice_days: number; due_reminder_days: number; overdue_reminder_days: number
        }
        Insert: {
          id?: number; expiry_alert_days?: number; adjustment_alert_days?: number; updated_at?: string
          notify_receipts?: boolean; notify_adjustments?: boolean; notify_due?: boolean; notify_overdue?: boolean
          adjustment_notice_days?: number; due_reminder_days?: number; overdue_reminder_days?: number
        }
        Update: {
          id?: number; expiry_alert_days?: number; adjustment_alert_days?: number; updated_at?: string
          notify_receipts?: boolean; notify_adjustments?: boolean; notify_due?: boolean; notify_overdue?: boolean
          adjustment_notice_days?: number; due_reminder_days?: number; overdue_reminder_days?: number
        }
        Relationships: []
      }
      rental_task_snoozes: {
        Row: { task_key: string; snoozed_until: string; reason: string | null; created_by: string | null; created_at: string }
        Insert: { task_key: string; snoozed_until: string; reason?: string | null; created_by?: string | null; created_at?: string }
        Update: { task_key?: string; snoozed_until?: string; reason?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      rental_portal_links: {
        Row: {
          id: string; contact_id: string; token_hash: string; expires_at: string; revoked_at: string | null
          last_viewed_at: string | null; view_count: number; created_by: string | null; created_at: string
        }
        Insert: {
          id?: string; contact_id: string; token_hash: string; expires_at?: string; revoked_at?: string | null
          last_viewed_at?: string | null; view_count?: number; created_by?: string | null; created_at?: string
        }
        Update: {
          id?: string; contact_id?: string; token_hash?: string; expires_at?: string; revoked_at?: string | null
          last_viewed_at?: string | null; view_count?: number; created_by?: string | null; created_at?: string
        }
        Relationships: []
      }
      rental_notifications: {
        Row: {
          id: string; contract_id: string; contact_id: string; kind: string; reference: string
          phone: string | null; status: string; detail: string | null; created_at: string
        }
        Insert: {
          id?: string; contract_id: string; contact_id: string; kind: string; reference: string
          phone?: string | null; status: string; detail?: string | null; created_at?: string
        }
        Update: {
          id?: string; contract_id?: string; contact_id?: string; kind?: string; reference?: string
          phone?: string | null; status?: string; detail?: string | null; created_at?: string
        }
        Relationships: []
      }
      rental_settlement_shares: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          paid_to_owner_at: string | null
          payout_method: string | null
          payout_reference: string | null
          settlement_id: string
          share_pct: number
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          paid_to_owner_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          settlement_id: string
          share_pct: number
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          paid_to_owner_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          settlement_id?: string
          share_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_settlement_shares_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "rental_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_settlement_shares_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "rental_settlements"
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
          other_collected_amount: number
          paid_to_owner_at: string | null
          payout_method: string | null
          payout_reference: string | null
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
          other_collected_amount?: number
          paid_to_owner_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
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
          other_collected_amount?: number
          paid_to_owner_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
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
      generate_recurring_expenses: { Args: never; Returns: number }
      increment_views: { Args: { property_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      rental_apply_adjustment: { Args: { p_contract_id: string; p_manual_amount?: number | null }; Returns: Json }
      rental_apply_due_adjustments: { Args: never; Returns: number }
      rental_accrue_late_fees: { Args: never; Returns: number }
      rental_owner_shares: {
        Args: { p_contract_id: string }
        Returns: { contact_id: string; is_primary: boolean; share_pct: number }[]
      }
      rental_close_contract: {
        Args: { p_contract_id: string; p_end_date?: string; p_penalty?: number; p_status: string }
        Returns: Json
      }
      set_property_owners: { Args: { p_property_id: string; p_owners: Json }; Returns: undefined }
      rental_import_contracts: { Args: { p_rows: Json }; Returns: number }
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
