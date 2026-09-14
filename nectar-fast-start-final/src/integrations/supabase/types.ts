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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["activity_direction"]
          duration_seconds: number | null
          id: string
          lead_id: string
          notes: string | null
          occurred_at: string
          outcome: Database["public"]["Enums"]["activity_outcome"] | null
          rep_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          direction?: Database["public"]["Enums"]["activity_direction"]
          duration_seconds?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          occurred_at?: string
          outcome?: Database["public"]["Enums"]["activity_outcome"] | null
          rep_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["activity_direction"]
          duration_seconds?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          occurred_at?: string
          outcome?: Database["public"]["Enums"]["activity_outcome"] | null
          rep_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          created_at: string
          direction: string
          duration_seconds: number | null
          from_number: string | null
          id: string
          lead_id: string
          recording_url: string | null
          rep_id: string | null
          status: string
          to_number: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          lead_id: string
          recording_url?: string | null
          rep_id?: string | null
          status?: string
          to_number?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          lead_id?: string
          recording_url?: string | null
          rep_id?: string | null
          status?: string
          to_number?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body: string
          created_at: string
          created_by: string
          failed_count: number
          id: string
          name: string
          sent_count: number
          status: string
          total_count: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          name: string
          sent_count?: number
          status?: string
          total_count?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          name?: string
          sent_count?: number
          status?: string
          total_count?: number
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          applies_to: Database["public"]["Enums"]["commission_applies_to"]
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          rate_type: Database["public"]["Enums"]["commission_rate_type"]
          rate_value: number
          role_in_deal: Database["public"]["Enums"]["commission_role"]
          updated_at: string
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["commission_applies_to"]
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          rate_type: Database["public"]["Enums"]["commission_rate_type"]
          rate_value: number
          role_in_deal: Database["public"]["Enums"]["commission_role"]
          updated_at?: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["commission_applies_to"]
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          rate_type?: Database["public"]["Enums"]["commission_rate_type"]
          rate_value?: number
          role_in_deal?: Database["public"]["Enums"]["commission_role"]
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deal_id: string
          id: string
          paid_at: string | null
          period_id: string | null
          role_in_deal: Database["public"]["Enums"]["commission_role"]
          rule_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
          user_id: string
          week_start: string | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deal_id: string
          id?: string
          paid_at?: string | null
          period_id?: string | null
          role_in_deal: Database["public"]["Enums"]["commission_role"]
          rule_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          user_id: string
          week_start?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          paid_at?: string | null
          period_id?: string | null
          role_in_deal?: Database["public"]["Enums"]["commission_role"]
          rule_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          user_id?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "quota_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contingent_placements: {
        Row: {
          created_at: string
          deal_id: string | null
          device_id: string | null
          expires_at: string
          followup_completed_at: string | null
          followup_due_at: string
          id: string
          lead_id: string
          outcome_notes: string | null
          picked_up_at: string | null
          placed_at: string
          rep_id: string
          status: Database["public"]["Enums"]["placement_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          device_id?: string | null
          expires_at?: string
          followup_completed_at?: string | null
          followup_due_at?: string
          id?: string
          lead_id: string
          outcome_notes?: string | null
          picked_up_at?: string | null
          placed_at?: string
          rep_id: string
          status?: Database["public"]["Enums"]["placement_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          device_id?: string | null
          expires_at?: string
          followup_completed_at?: string | null
          followup_due_at?: string
          id?: string
          lead_id?: string
          outcome_notes?: string | null
          picked_up_at?: string | null
          placed_at?: string
          rep_id?: string
          status?: Database["public"]["Enums"]["placement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contingent_placements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contingent_placements_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contingent_placements_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contingent_placements_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          contract_signature: string | null
          contract_signed_at: string | null
          contract_signer_name: string | null
          converted_from_deal_id: string | null
          created_at: string
          device_id: string | null
          hardware_amount: number
          id: string
          is_demo: boolean
          lead_id: string
          nectarpay_checkout_url: string | null
          nectarpay_expires_at: string | null
          nectarpay_invoice_id: string | null
          nectarpay_status: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          rep_id: string
          status: Database["public"]["Enums"]["deal_status"]
          subscription_monthly: number
          subscription_months: number
          total_amount: number | null
          type: Database["public"]["Enums"]["deal_type"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          contract_signature?: string | null
          contract_signed_at?: string | null
          contract_signer_name?: string | null
          converted_from_deal_id?: string | null
          created_at?: string
          device_id?: string | null
          hardware_amount?: number
          id?: string
          is_demo?: boolean
          lead_id: string
          nectarpay_checkout_url?: string | null
          nectarpay_expires_at?: string | null
          nectarpay_invoice_id?: string | null
          nectarpay_status?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          rep_id: string
          status?: Database["public"]["Enums"]["deal_status"]
          subscription_monthly?: number
          subscription_months?: number
          total_amount?: number | null
          type?: Database["public"]["Enums"]["deal_type"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          contract_signature?: string | null
          contract_signed_at?: string | null
          contract_signer_name?: string | null
          converted_from_deal_id?: string | null
          created_at?: string
          device_id?: string | null
          hardware_amount?: number
          id?: string
          is_demo?: boolean
          lead_id?: string
          nectarpay_checkout_url?: string | null
          nectarpay_expires_at?: string | null
          nectarpay_invoice_id?: string | null
          nectarpay_status?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          rep_id?: string
          status?: Database["public"]["Enums"]["deal_status"]
          subscription_monthly?: number
          subscription_months?: number
          total_amount?: number | null
          type?: Database["public"]["Enums"]["deal_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_converted_from_deal_id_fkey"
            columns: ["converted_from_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      devices: {
        Row: {
          assigned_rep_id: string | null
          coin_id: string | null
          created_at: string
          current_lead_id: string | null
          id: string
          model: string
          notes: string | null
          serial_number: string
          status: Database["public"]["Enums"]["device_status"]
          updated_at: string
        }
        Insert: {
          assigned_rep_id?: string | null
          coin_id?: string | null
          created_at?: string
          current_lead_id?: string | null
          id?: string
          model?: string
          notes?: string | null
          serial_number: string
          status?: Database["public"]["Enums"]["device_status"]
          updated_at?: string
        }
        Update: {
          assigned_rep_id?: string | null
          coin_id?: string | null
          created_at?: string
          current_lead_id?: string | null
          id?: string
          model?: string
          notes?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["device_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_assigned_rep_id_fkey"
            columns: ["assigned_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "devices_current_lead_id_fkey"
            columns: ["current_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body: string
          click_count: number
          created_at: string
          created_by: string
          cta_label: string | null
          cta_url: string | null
          failed_count: number
          id: string
          name: string
          sent_count: number
          status: string
          subject: string
          total_count: number
          updated_at: string
        }
        Insert: {
          body: string
          click_count?: number
          created_at?: string
          created_by: string
          cta_label?: string | null
          cta_url?: string | null
          failed_count?: number
          id?: string
          name: string
          sent_count?: number
          status?: string
          subject: string
          total_count?: number
          updated_at?: string
        }
        Update: {
          body?: string
          click_count?: number
          created_at?: string
          created_by?: string
          cta_label?: string | null
          cta_url?: string | null
          failed_count?: number
          id?: string
          name?: string
          sent_count?: number
          status?: string
          subject?: string
          total_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_click_events: {
        Row: {
          campaign_id: string
          clicked_at: string
          id: string
          ip_address: string | null
          label: string | null
          lead_id: string
          recipient_id: string
          url: string
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string
          id?: string
          ip_address?: string | null
          label?: string | null
          lead_id: string
          recipient_id: string
          url: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string
          id?: string
          ip_address?: string | null
          label?: string | null
          lead_id?: string
          recipient_id?: string
          url?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_click_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_click_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_click_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "email_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_recipients: {
        Row: {
          campaign_id: string
          click_count: number
          created_at: string
          email: string
          error: string | null
          first_clicked_at: string | null
          id: string
          last_clicked_at: string | null
          lead_id: string
          message_id: string | null
          opened_at: string | null
          status: string
          unsubscribed_at: string | null
        }
        Insert: {
          campaign_id: string
          click_count?: number
          created_at?: string
          email: string
          error?: string | null
          first_clicked_at?: string | null
          id?: string
          last_clicked_at?: string | null
          lead_id: string
          message_id?: string | null
          opened_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Update: {
          campaign_id?: string
          click_count?: number
          created_at?: string
          email?: string
          error?: string | null
          first_clicked_at?: string | null
          id?: string
          last_clicked_at?: string | null
          lead_id?: string
          message_id?: string | null
          opened_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      knowledge_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_items: {
        Row: {
          body: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          embed_url: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          kind: string
          provider: string | null
          published: boolean
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          embed_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          kind?: string
          provider?: string | null
          published?: boolean
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          embed_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          kind?: string
          provider?: string | null
          published?: boolean
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_documents: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string | null
          document_type: string
          file_name: string
          file_size: number | null
          id: string
          lead_id: string
          mime_type: string
          storage_path: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id?: string | null
          document_type: string
          file_name: string
          file_size?: number | null
          id?: string
          lead_id: string
          mime_type?: string
          storage_path: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          lead_id?: string
          mime_type?: string
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_line1: string | null
          admin_notes: string | null
          business_name: string | null
          business_type: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone_e164: string | null
          created_at: string
          email_opted_out_at: string | null
          first_contacted_at: string | null
          follow_up_at: string | null
          google_place_id: string | null
          id: string
          interest: string | null
          ip_address: string | null
          last_activity_at: string | null
          last_contacted_at: string | null
          lat: number | null
          lng: number | null
          market: string | null
          message: string | null
          owner_rep_id: string | null
          postal_code: string | null
          preferred_time: string | null
          referred_by_lead_id: string | null
          sms_consent: boolean
          sms_opted_out_at: string | null
          source: Database["public"]["Enums"]["lead_source"]
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          telegram: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          address_line1?: string | null
          admin_notes?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone_e164?: string | null
          created_at?: string
          email_opted_out_at?: string | null
          first_contacted_at?: string | null
          follow_up_at?: string | null
          google_place_id?: string | null
          id?: string
          interest?: string | null
          ip_address?: string | null
          last_activity_at?: string | null
          last_contacted_at?: string | null
          lat?: number | null
          lng?: number | null
          market?: string | null
          message?: string | null
          owner_rep_id?: string | null
          postal_code?: string | null
          preferred_time?: string | null
          referred_by_lead_id?: string | null
          sms_consent?: boolean
          sms_opted_out_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telegram?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          address_line1?: string | null
          admin_notes?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone_e164?: string | null
          created_at?: string
          email_opted_out_at?: string | null
          first_contacted_at?: string | null
          follow_up_at?: string | null
          google_place_id?: string | null
          id?: string
          interest?: string | null
          ip_address?: string | null
          last_activity_at?: string | null
          last_contacted_at?: string | null
          lat?: number | null
          lng?: number | null
          market?: string | null
          message?: string | null
          owner_rep_id?: string | null
          postal_code?: string | null
          preferred_time?: string | null
          referred_by_lead_id?: string | null
          sms_consent?: boolean
          sms_opted_out_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telegram?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_rep_id_fkey"
            columns: ["owner_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_referred_by_lead_id_fkey"
            columns: ["referred_by_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          active: boolean
          created_at: string
          id: string
          manager_email: string | null
          manager_name: string | null
          manager_telegram: string | null
          name: string
          notes: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_telegram?: string | null
          name: string
          notes?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_telegram?: string | null
          name?: string
          notes?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      members_geo: {
        Row: {
          city: string | null
          country: string
          created_at: string
          id: number
          lat: number
          lng: number
          source: string | null
          state: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          id?: number
          lat: number
          lng: number
          source?: string | null
          state?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          id?: number
          lat?: number
          lng?: number
          source?: string | null
          state?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          campaign_id: string | null
          created_at: string
          direction: string
          error: string | null
          from_number: string | null
          id: string
          lead_id: string
          sent_by: string | null
          status: string
          to_number: string | null
          twilio_sid: string | null
        }
        Insert: {
          body: string
          campaign_id?: string | null
          created_at?: string
          direction: string
          error?: string | null
          from_number?: string | null
          id?: string
          lead_id: string
          sent_by?: string | null
          status?: string
          to_number?: string | null
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          campaign_id?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          from_number?: string | null
          id?: string
          lead_id?: string
          sent_by?: string | null
          status?: string
          to_number?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error: string | null
          event: string
          id: string
          metadata: Json | null
          recipient: string
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          error?: string | null
          event: string
          id?: string
          metadata?: Json | null
          recipient: string
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          metadata?: Json | null
          recipient?: string
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          created_at: string
          email_address: string | null
          email_enabled: boolean
          events: Json
          telegram_chat_id: string | null
          telegram_enabled: boolean
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          email_enabled?: boolean
          events?: Json
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_address?: string | null
          email_enabled?: boolean
          events?: Json
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pnl_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          affiliate_id: string | null
          assigned_phone_number: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          hire_date: string | null
          home_address: string | null
          home_lat: number | null
          home_lng: number | null
          is_active: boolean
          location_sharing_enabled: boolean
          onboarding_completed_at: string | null
          onboarding_step: string | null
          phone_e164: string | null
          terminal_order_clicked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          assigned_phone_number?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          hire_date?: string | null
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          is_active?: boolean
          location_sharing_enabled?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          phone_e164?: string | null
          terminal_order_clicked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          assigned_phone_number?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          hire_date?: string | null
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          is_active?: boolean
          location_sharing_enabled?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          phone_e164?: string | null
          terminal_order_clicked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quota_periods: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      quotas: {
        Row: {
          contingents_target: number
          created_at: string
          id: string
          period_id: string
          rep_id: string
          sales_minimum: number
          sales_target: number
          touches_target: number
          updated_at: string
        }
        Insert: {
          contingents_target?: number
          created_at?: string
          id?: string
          period_id: string
          rep_id: string
          sales_minimum?: number
          sales_target?: number
          touches_target?: number
          updated_at?: string
        }
        Update: {
          contingents_target?: number
          created_at?: string
          id?: string
          period_id?: string
          rep_id?: string
          sales_minimum?: number
          sales_target?: number
          touches_target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotas_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "quota_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotas_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rep_locations: {
        Row: {
          accuracy_meters: number | null
          created_at: string
          lat: number
          lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          created_at?: string
          lat: number
          lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          created_at?: string
          lat?: number
          lng?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rep_salaries: {
        Row: {
          created_at: string
          updated_at: string
          updated_by: string | null
          user_id: string
          weekly_salary: number
        }
        Insert: {
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          weekly_salary?: number
        }
        Update: {
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          weekly_salary?: number
        }
        Relationships: [
          {
            foreignKeyName: "rep_salaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string
          auto_generated: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          placement_id: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to: string
          auto_generated?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          placement_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          auto_generated?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          placement_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "contingent_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          manager_id: string | null
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      telegram_bind_codes: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          user_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_accounts: {
        Row: {
          chain: string
          first_seen_at: string
          last_login_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          chain?: string
          first_seen_at?: string
          last_login_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          chain?: string
          first_seen_at?: string
          last_login_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      wallet_login_challenges: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          nonce: string
          one_time_token: string | null
          signature: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["wallet_challenge_status"]
          user_agent: string | null
          wallet_address: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          nonce: string
          one_time_token?: string | null
          signature?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["wallet_challenge_status"]
          user_agent?: string | null
          wallet_address?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          nonce?: string
          one_time_token?: string | null
          signature?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["wallet_challenge_status"]
          user_agent?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_deal_with_terminal: {
        Args: {
          p_deal_type: Database["public"]["Enums"]["deal_type"]
          p_device_id: string
          p_duration_days: number
          p_hardware_amount: number
          p_is_demo: boolean
          p_lead_id: string
          p_notes: string
          p_payment_method: string
          p_subscription_monthly: number
          p_subscription_months: number
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_rep_directory: {
        Args: never
        Returns: {
          email: string
          full_name: string
          is_active: boolean
          user_id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purge_expired_wallet_challenges: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      run_contingent_maintenance: { Args: never; Returns: Json }
      visible_rep_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      activity_direction: "outbound" | "inbound"
      activity_outcome:
        | "connected"
        | "no_answer"
        | "gatekeeper"
        | "pitched"
        | "objection"
        | "not_interested"
      activity_type: "call" | "email" | "sms" | "visit" | "note" | "meeting"
      app_role: "admin" | "merchant" | "manager" | "rep"
      commission_applies_to: "hardware" | "subscription" | "total"
      commission_rate_type: "flat" | "percent"
      commission_role: "rep" | "manager_override" | "gm_override"
      commission_status: "pending" | "approved" | "paid" | "clawed_back"
      deal_status:
        | "open"
        | "won"
        | "lost"
        | "converted"
        | "returned"
        | "pending"
      deal_type: "sale" | "contingent"
      device_status:
        | "in_inventory"
        | "assigned_to_rep"
        | "placed_contingent"
        | "sold"
        | "returned"
        | "lost"
        | "damaged"
        | "pending_sale"
      lead_source:
        | "cold_walk_in"
        | "referral"
        | "web_intake"
        | "campaign"
        | "manual"
      lead_status:
        | "new"
        | "contacted"
        | "thinking"
        | "contingent"
        | "won"
        | "lost"
        | "do_not_contact"
        | "pending"
      placement_status:
        | "active"
        | "converted"
        | "returned"
        | "overdue"
        | "extended"
      task_type:
        | "contingent_followup"
        | "contingent_pickup"
        | "callback"
        | "manual"
      wallet_challenge_status: "pending" | "signed" | "consumed" | "expired"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_direction: ["outbound", "inbound"],
      activity_outcome: [
        "connected",
        "no_answer",
        "gatekeeper",
        "pitched",
        "objection",
        "not_interested",
      ],
      activity_type: ["call", "email", "sms", "visit", "note", "meeting"],
      app_role: ["admin", "merchant", "manager", "rep"],
      commission_applies_to: ["hardware", "subscription", "total"],
      commission_rate_type: ["flat", "percent"],
      commission_role: ["rep", "manager_override", "gm_override"],
      commission_status: ["pending", "approved", "paid", "clawed_back"],
      deal_status: ["open", "won", "lost", "converted", "returned", "pending"],
      deal_type: ["sale", "contingent"],
      device_status: [
        "in_inventory",
        "assigned_to_rep",
        "placed_contingent",
        "sold",
        "returned",
        "lost",
        "damaged",
        "pending_sale",
      ],
      lead_source: [
        "cold_walk_in",
        "referral",
        "web_intake",
        "campaign",
        "manual",
      ],
      lead_status: [
        "new",
        "contacted",
        "thinking",
        "contingent",
        "won",
        "lost",
        "do_not_contact",
        "pending",
      ],
      placement_status: [
        "active",
        "converted",
        "returned",
        "overdue",
        "extended",
      ],
      task_type: [
        "contingent_followup",
        "contingent_pickup",
        "callback",
        "manual",
      ],
      wallet_challenge_status: ["pending", "signed", "consumed", "expired"],
    },
  },
} as const
