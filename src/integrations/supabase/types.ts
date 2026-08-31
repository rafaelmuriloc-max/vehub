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
      asaas_charges: {
        Row: {
          asaas_charge_id: string
          asaas_subscription_id: string | null
          bank_slip_url: string | null
          billing_type: string | null
          client_id: string | null
          created_at: string
          due_date: string | null
          entry_id: string | null
          environment: string
          id: string
          invoice_url: string | null
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          raw: Json | null
          status: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_charge_id: string
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          entry_id?: string | null
          environment?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          asaas_charge_id?: string
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          entry_id?: string | null
          environment?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          client_id: string
          created_at: string
          environment: string
          id: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          asaas_customer_id: string
          client_id: string
          created_at?: string
          environment?: string
          id?: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string
          client_id?: string
          created_at?: string
          environment?: string
          id?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_settings: {
        Row: {
          created_at: string
          default_billing_type: string
          default_due_days: number
          enabled: boolean
          environment: string
          id: string
          last_sync_at: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          default_billing_type?: string
          default_due_days?: number
          enabled?: boolean
          environment?: string
          id?: string
          last_sync_at?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          default_billing_type?: string
          default_due_days?: number
          enabled?: boolean
          environment?: string
          id?: string
          last_sync_at?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      asaas_subscriptions: {
        Row: {
          asaas_subscription_id: string
          billing_type: string | null
          client_id: string | null
          created_at: string
          cycle: string
          description: string | null
          environment: string
          id: string
          next_due_date: string | null
          raw: Json | null
          status: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_subscription_id: string
          billing_type?: string | null
          client_id?: string | null
          created_at?: string
          cycle?: string
          description?: string | null
          environment?: string
          id?: string
          next_due_date?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          asaas_subscription_id?: string
          billing_type?: string | null
          client_id?: string | null
          created_at?: string
          cycle?: string
          description?: string | null
          environment?: string
          id?: string
          next_due_date?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          error: string | null
          event: string
          id: string
          payload: Json
          processed: boolean
          received_at: string
        }
        Insert: {
          error?: string | null
          event: string
          id?: string
          payload: Json
          processed?: boolean
          received_at?: string
        }
        Update: {
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          active: boolean
          agency: string | null
          bank_name: string | null
          color: string | null
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_asaas: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          active?: boolean
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_asaas?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          active?: boolean
          agency?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_asaas?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bill_payments: {
        Row: {
          asaas_payment_id: string | null
          bar_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          entry_id: string | null
          environment: string
          id: string
          pix_qr_code: string | null
          raw: Json | null
          scheduled_date: string | null
          status: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_payment_id?: string | null
          bar_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          entry_id?: string | null
          environment?: string
          id?: string
          pix_qr_code?: string | null
          raw?: Json | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          asaas_payment_id?: string | null
          bar_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          entry_id?: string | null
          environment?: string
          id?: string
          pix_qr_code?: string | null
          raw?: Json | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          awaiting_first_reply: boolean
          client_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_inactivity_alert_at: string | null
          last_wait_alert_at: string | null
          name: string | null
          name_locked: boolean
          status: string
          total_wait_seconds: number
          triage_department_id: string | null
          triage_status: string
          triage_summary: string | null
          triage_turns: number
          triaged_department_id: string | null
          updated_at: string
          waiting_since: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          awaiting_first_reply?: boolean
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          last_inactivity_alert_at?: string | null
          last_wait_alert_at?: string | null
          name?: string | null
          name_locked?: boolean
          status?: string
          total_wait_seconds?: number
          triage_department_id?: string | null
          triage_status?: string
          triage_summary?: string | null
          triage_turns?: number
          triaged_department_id?: string | null
          updated_at?: string
          waiting_since?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          awaiting_first_reply?: boolean
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          last_inactivity_alert_at?: string | null
          last_wait_alert_at?: string | null
          name?: string | null
          name_locked?: boolean
          status?: string
          total_wait_seconds?: number
          triage_department_id?: string | null
          triage_status?: string
          triage_summary?: string | null
          triage_turns?: number
          triaged_department_id?: string | null
          updated_at?: string
          waiting_since?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_name: string | null
          channel: string
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_for: string[]
          edited_at: string | null
          id: string
          is_forwarded: boolean
          media_url: string | null
          message_type: string
          read_at: string | null
          reply_to_id: string | null
          reply_to_snapshot: Json | null
          sender_id: string
          transcription: string | null
          transcription_status: string | null
          wa_evolution_id: string | null
          wa_message_id: string | null
          wa_remote_jid: string | null
        }
        Insert: {
          agent_name?: string | null
          channel?: string
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          edited_at?: string | null
          id?: string
          is_forwarded?: boolean
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          reply_to_snapshot?: Json | null
          sender_id: string
          transcription?: string | null
          transcription_status?: string | null
          wa_evolution_id?: string | null
          wa_message_id?: string | null
          wa_remote_jid?: string | null
        }
        Update: {
          agent_name?: string | null
          channel?: string
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          edited_at?: string | null
          id?: string
          is_forwarded?: boolean
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          reply_to_snapshot?: Json | null
          sender_id?: string
          transcription?: string | null
          transcription_status?: string | null
          wa_evolution_id?: string | null
          wa_message_id?: string | null
          wa_remote_jid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_department_contacts: {
        Row: {
          client_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          department_id: string
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          department_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          department_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_department_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_department_contacts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_department_obligations: {
        Row: {
          client_id: string
          created_at: string
          department_id: string
          id: string
          obligation_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          department_id: string
          id?: string
          obligation_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          department_id?: string
          id?: string
          obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_department_obligations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_department_obligations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_department_obligations_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_society_documents: {
        Row: {
          client_id: string
          created_at: string
          document_label: string
          file_name: string
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          document_label: string
          file_name: string
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          document_label?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_society_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          business_classification: string | null
          business_segment: string | null
          cadastral_status: string | null
          company_description: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          destination_office_name: string | null
          digital_certificate_expiry: string | null
          digital_certificate_password: string | null
          digital_certificate_type: string | null
          digital_certificate_url: string | null
          document: string | null
          employee_count: number | null
          end_date: string | null
          exit_reason: string | null
          exit_reason_notes: string | null
          foundation_date: string | null
          from_another_office: boolean
          id: string
          last_nfe_nsu: string | null
          last_nsu: string | null
          main_activity: string | null
          monthly_value: number | null
          municipal_registration: string | null
          notes: string | null
          opening_date: string | null
          partners_info: string | null
          payroll_notes: string | null
          payroll_type: string | null
          permits: string | null
          previous_office_name: string | null
          sci_code: string | null
          secondary_activities: string | null
          services_suspended: boolean
          services_suspended_at: string | null
          simples_anexo: string | null
          start_date: string | null
          state_registration: string | null
          status: Database["public"]["Enums"]["client_status"]
          success_notes: string | null
          tax_regime: string | null
          trade_name: string | null
          updated_at: string
          without_monthly_fee: boolean
        }
        Insert: {
          address?: string | null
          business_classification?: string | null
          business_segment?: string | null
          cadastral_status?: string | null
          company_description?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          destination_office_name?: string | null
          digital_certificate_expiry?: string | null
          digital_certificate_password?: string | null
          digital_certificate_type?: string | null
          digital_certificate_url?: string | null
          document?: string | null
          employee_count?: number | null
          end_date?: string | null
          exit_reason?: string | null
          exit_reason_notes?: string | null
          foundation_date?: string | null
          from_another_office?: boolean
          id?: string
          last_nfe_nsu?: string | null
          last_nsu?: string | null
          main_activity?: string | null
          monthly_value?: number | null
          municipal_registration?: string | null
          notes?: string | null
          opening_date?: string | null
          partners_info?: string | null
          payroll_notes?: string | null
          payroll_type?: string | null
          permits?: string | null
          previous_office_name?: string | null
          sci_code?: string | null
          secondary_activities?: string | null
          services_suspended?: boolean
          services_suspended_at?: string | null
          simples_anexo?: string | null
          start_date?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          success_notes?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          without_monthly_fee?: boolean
        }
        Update: {
          address?: string | null
          business_classification?: string | null
          business_segment?: string | null
          cadastral_status?: string | null
          company_description?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          destination_office_name?: string | null
          digital_certificate_expiry?: string | null
          digital_certificate_password?: string | null
          digital_certificate_type?: string | null
          digital_certificate_url?: string | null
          document?: string | null
          employee_count?: number | null
          end_date?: string | null
          exit_reason?: string | null
          exit_reason_notes?: string | null
          foundation_date?: string | null
          from_another_office?: boolean
          id?: string
          last_nfe_nsu?: string | null
          last_nsu?: string | null
          main_activity?: string | null
          monthly_value?: number | null
          municipal_registration?: string | null
          notes?: string | null
          opening_date?: string | null
          partners_info?: string | null
          payroll_notes?: string | null
          payroll_type?: string | null
          permits?: string | null
          previous_office_name?: string | null
          sci_code?: string | null
          secondary_activities?: string | null
          services_suspended?: boolean
          services_suspended_at?: string | null
          simples_anexo?: string | null
          start_date?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          success_notes?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          without_monthly_fee?: boolean
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          accountant_certificate_expiry: string | null
          accountant_certificate_password: string | null
          accountant_certificate_url: string | null
          accountant_cpf: string | null
          address: string | null
          agent_name: string | null
          agent_offhours_last_sent: Json
          agent_offhours_message: string | null
          cert_responsible_name: string | null
          cert_responsible_phone: string | null
          cert_whatsapp_group_id: string | null
          chat_alert_whatsapp_group_id: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          digital_certificate_expiry: string | null
          digital_certificate_password: string | null
          digital_certificate_url: string | null
          email: string | null
          gmail_connected_email: string | null
          gmail_last_history_id: string | null
          gmail_last_sync_at: string | null
          id: string
          logo_url: string | null
          phone: string | null
          serpro_cnpj: string | null
          service_close_time: string | null
          service_hours_enabled: boolean
          service_lunch_end: string | null
          service_lunch_start: string | null
          service_open_time: string | null
          service_timezone: string
          triage_direct_route_department_id: string | null
          triage_direct_route_enabled: boolean
          triage_direct_route_user_id: string | null
          triage_enabled: boolean
          triage_fallback_department_id: string | null
          triage_system_prompt: string | null
          updated_at: string
        }
        Insert: {
          accountant_certificate_expiry?: string | null
          accountant_certificate_password?: string | null
          accountant_certificate_url?: string | null
          accountant_cpf?: string | null
          address?: string | null
          agent_name?: string | null
          agent_offhours_last_sent?: Json
          agent_offhours_message?: string | null
          cert_responsible_name?: string | null
          cert_responsible_phone?: string | null
          cert_whatsapp_group_id?: string | null
          chat_alert_whatsapp_group_id?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          digital_certificate_expiry?: string | null
          digital_certificate_password?: string | null
          digital_certificate_url?: string | null
          email?: string | null
          gmail_connected_email?: string | null
          gmail_last_history_id?: string | null
          gmail_last_sync_at?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          serpro_cnpj?: string | null
          service_close_time?: string | null
          service_hours_enabled?: boolean
          service_lunch_end?: string | null
          service_lunch_start?: string | null
          service_open_time?: string | null
          service_timezone?: string
          triage_direct_route_department_id?: string | null
          triage_direct_route_enabled?: boolean
          triage_direct_route_user_id?: string | null
          triage_enabled?: boolean
          triage_fallback_department_id?: string | null
          triage_system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          accountant_certificate_expiry?: string | null
          accountant_certificate_password?: string | null
          accountant_certificate_url?: string | null
          accountant_cpf?: string | null
          address?: string | null
          agent_name?: string | null
          agent_offhours_last_sent?: Json
          agent_offhours_message?: string | null
          cert_responsible_name?: string | null
          cert_responsible_phone?: string | null
          cert_whatsapp_group_id?: string | null
          chat_alert_whatsapp_group_id?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          digital_certificate_expiry?: string | null
          digital_certificate_password?: string | null
          digital_certificate_url?: string | null
          email?: string | null
          gmail_connected_email?: string | null
          gmail_last_history_id?: string | null
          gmail_last_sync_at?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          serpro_cnpj?: string | null
          service_close_time?: string | null
          service_hours_enabled?: boolean
          service_lunch_end?: string | null
          service_lunch_start?: string | null
          service_open_time?: string | null
          service_timezone?: string
          triage_direct_route_department_id?: string | null
          triage_direct_route_enabled?: boolean
          triage_direct_route_user_id?: string | null
          triage_enabled?: boolean
          triage_fallback_department_id?: string | null
          triage_system_prompt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          active: boolean
          code: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      department_credentials: {
        Row: {
          department_id: string
          smtp_email: string | null
          smtp_password: string | null
          updated_at: string
        }
        Insert: {
          department_id: string
          smtp_email?: string | null
          smtp_password?: string | null
          updated_at?: string
        }
        Update: {
          department_id?: string
          smtp_email?: string | null
          smtp_password?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_credentials_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          triage_keywords: string | null
          triage_prompt: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          triage_keywords?: string | null
          triage_prompt?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          triage_keywords?: string | null
          triage_prompt?: string | null
        }
        Relationships: []
      }
      document_types: {
        Row: {
          created_at: string
          description: string | null
          extraction_config: Json | null
          id: string
          name: string
          sample_file_name: string | null
          sample_file_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          extraction_config?: Json | null
          id?: string
          name: string
          sample_file_name?: string | null
          sample_file_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          extraction_config?: Json | null
          id?: string
          name?: string
          sample_file_name?: string | null
          sample_file_url?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          client_id: string
          created_at: string
          document_type_id: string
          file_name: string
          file_url: string
          id: string
          linked_obligation_id: string | null
          reference_month: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          document_type_id: string
          file_name: string
          file_url: string
          id?: string
          linked_obligation_id?: string | null
          reference_month: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          document_type_id?: string
          file_name?: string
          file_url?: string
          id?: string
          linked_obligation_id?: string | null
          reference_month?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          created_at: string
          filename: string
          gmail_attachment_id: string | null
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          gmail_attachment_id?: string | null
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          gmail_attachment_id?: string | null
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body_html: string | null
          client_id: string | null
          created_at: string
          department_id: string
          id: string
          obligation_id: string | null
          opened_at: string | null
          recipient_email: string
          reference_month: string | null
          sent_at: string
          status: string
          subject: string
        }
        Insert: {
          body_html?: string | null
          client_id?: string | null
          created_at?: string
          department_id: string
          id?: string
          obligation_id?: string | null
          opened_at?: string | null
          recipient_email: string
          reference_month?: string | null
          sent_at?: string
          status?: string
          subject: string
        }
        Update: {
          body_html?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string
          id?: string
          obligation_id?: string | null
          opened_at?: string | null
          recipient_email?: string
          reference_month?: string | null
          sent_at?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_emails: string[]
          client_id: string | null
          created_at: string
          from_email: string | null
          from_name: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          has_attachments: boolean
          id: string
          is_archived: boolean
          is_read: boolean
          is_sent: boolean
          is_starred: boolean
          is_trashed: boolean
          labels: string[]
          received_at: string
          snippet: string | null
          subject: string | null
          to_emails: string[]
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          client_id?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          has_attachments?: boolean
          id?: string
          is_archived?: boolean
          is_read?: boolean
          is_sent?: boolean
          is_starred?: boolean
          is_trashed?: boolean
          labels?: string[]
          received_at?: string
          snippet?: string | null
          subject?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          client_id?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          has_attachments?: boolean
          id?: string
          is_archived?: boolean
          is_read?: boolean
          is_sent?: boolean
          is_starred?: boolean
          is_trashed?: boolean
          labels?: string[]
          received_at?: string
          snippet?: string | null
          subject?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["financial_entry_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["financial_entry_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["financial_entry_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          asaas_charge_id: string | null
          bank_account_id: string | null
          category_id: string | null
          client_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          paid_date: string | null
          recurring_id: string | null
          status: Database["public"]["Enums"]["financial_entry_status"]
          type: Database["public"]["Enums"]["financial_entry_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_charge_id?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          paid_date?: string | null
          recurring_id?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          type: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_charge_id?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          paid_date?: string | null
          recurring_id?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          type?: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      integra_contador_cache: {
        Row: {
          cache_key: string
          cache_value: string
          created_at: string | null
          expires_at: string
          id: string
        }
        Insert: {
          cache_key: string
          cache_value: string
          created_at?: string | null
          expires_at: string
          id?: string
        }
        Update: {
          cache_key?: string
          cache_value?: string
          created_at?: string | null
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          access_key: string | null
          client_id: string
          created_at: string
          gross_value: number | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          issuer_cnpj: string | null
          municipality_code: string | null
          net_value: number | null
          pdf_url: string | null
          raw_data: Json | null
          service_description: string | null
          status: string | null
          taker_cnpj: string | null
          tax_value: number | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          client_id: string
          created_at?: string
          gross_value?: number | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          issuer_cnpj?: string | null
          municipality_code?: string | null
          net_value?: number | null
          pdf_url?: string | null
          raw_data?: Json | null
          service_description?: string | null
          status?: string | null
          taker_cnpj?: string | null
          tax_value?: number | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          client_id?: string
          created_at?: string
          gross_value?: number | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          issuer_cnpj?: string | null
          municipality_code?: string | null
          net_value?: number | null
          pdf_url?: string | null
          raw_data?: Json | null
          service_description?: string | null
          status?: string | null
          taker_cnpj?: string | null
          tax_value?: number | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_invoices: {
        Row: {
          access_key: string | null
          client_id: string
          created_at: string
          direction: string
          emitter_cnpj: string | null
          emitter_name: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          nsu: string | null
          pdf_url: string | null
          raw_xml: string | null
          recipient_cnpj: string | null
          recipient_name: string | null
          status: string | null
          total_value: number | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          client_id: string
          created_at?: string
          direction?: string
          emitter_cnpj?: string | null
          emitter_name?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          nsu?: string | null
          pdf_url?: string | null
          raw_xml?: string | null
          recipient_cnpj?: string | null
          recipient_name?: string | null
          status?: string | null
          total_value?: number | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          client_id?: string
          created_at?: string
          direction?: string
          emitter_cnpj?: string | null
          emitter_name?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          nsu?: string | null
          pdf_url?: string | null
          raw_xml?: string | null
          recipient_cnpj?: string | null
          recipient_name?: string | null
          status?: string | null
          total_value?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_activities: {
        Row: {
          auto_start: boolean
          created_at: string
          description: string | null
          document_type_id: string | null
          email_body: string | null
          email_department_id: string | null
          email_subject: string | null
          id: string
          obligation_id: string
          order: number
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          whatsapp_button_url: string | null
          whatsapp_has_document_header: boolean
          whatsapp_message_body: string | null
          whatsapp_template_name: string | null
        }
        Insert: {
          auto_start?: boolean
          created_at?: string
          description?: string | null
          document_type_id?: string | null
          email_body?: string | null
          email_department_id?: string | null
          email_subject?: string | null
          id?: string
          obligation_id: string
          order?: number
          title: string
          type?: Database["public"]["Enums"]["activity_type"]
          whatsapp_button_url?: string | null
          whatsapp_has_document_header?: boolean
          whatsapp_message_body?: string | null
          whatsapp_template_name?: string | null
        }
        Update: {
          auto_start?: boolean
          created_at?: string
          description?: string | null
          document_type_id?: string | null
          email_body?: string | null
          email_department_id?: string | null
          email_subject?: string | null
          id?: string
          obligation_id?: string
          order?: number
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          whatsapp_button_url?: string | null
          whatsapp_has_document_header?: boolean
          whatsapp_message_body?: string | null
          whatsapp_template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obligation_activities_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_activities_email_department_id_fkey"
            columns: ["email_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_activities_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_activity_completions: {
        Row: {
          activity_id: string
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          failure_reason: string | null
          file_url: string | null
          id: string
          instance_id: string
          last_retry_at: string | null
          notes: string | null
          retry_count: number
        }
        Insert: {
          activity_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          failure_reason?: string | null
          file_url?: string | null
          id?: string
          instance_id: string
          last_retry_at?: string | null
          notes?: string | null
          retry_count?: number
        }
        Update: {
          activity_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          failure_reason?: string | null
          file_url?: string | null
          id?: string
          instance_id?: string
          last_retry_at?: string | null
          notes?: string | null
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "obligation_activity_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "obligation_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_activity_completions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "obligation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_instances: {
        Row: {
          assigned_to: string | null
          client_id: string
          completion_kind: string | null
          created_at: string
          deleted_at: string | null
          due_date: string | null
          hold_at: string | null
          hold_by: string | null
          hold_reason: string | null
          id: string
          obligation_id: string
          on_hold: boolean
          reference_month: string
          status: Database["public"]["Enums"]["obligation_status"]
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          completion_kind?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          hold_at?: string | null
          hold_by?: string | null
          hold_reason?: string | null
          id?: string
          obligation_id: string
          on_hold?: boolean
          reference_month: string
          status?: Database["public"]["Enums"]["obligation_status"]
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          completion_kind?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          hold_at?: string | null
          hold_by?: string | null
          hold_reason?: string | null
          id?: string
          obligation_id?: string
          on_hold?: boolean
          reference_month?: string
          status?: Database["public"]["Enums"]["obligation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "obligation_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_instances_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          alert_day: number | null
          annual_month: number | null
          assignment_mode: string
          competence_rule: string
          created_at: string
          department_id: string
          description: string | null
          due_day: number | null
          id: string
          is_retention: boolean
          is_tax: boolean
          name: string
          recurrence: string
          retention_tax_type: string | null
          segment_filters: Json | null
          system_code: string | null
          target_day: number | null
          tax_sphere: string | null
          updated_at: string
        }
        Insert: {
          alert_day?: number | null
          annual_month?: number | null
          assignment_mode?: string
          competence_rule?: string
          created_at?: string
          department_id: string
          description?: string | null
          due_day?: number | null
          id?: string
          is_retention?: boolean
          is_tax?: boolean
          name: string
          recurrence?: string
          retention_tax_type?: string | null
          segment_filters?: Json | null
          system_code?: string | null
          target_day?: number | null
          tax_sphere?: string | null
          updated_at?: string
        }
        Update: {
          alert_day?: number | null
          annual_month?: number | null
          assignment_mode?: string
          competence_rule?: string
          created_at?: string
          department_id?: string
          description?: string | null
          due_day?: number | null
          id?: string
          is_retention?: boolean
          is_tax?: boolean
          name?: string
          recurrence?: string
          retention_tax_type?: string | null
          segment_filters?: Json | null
          system_code?: string | null
          target_day?: number | null
          tax_sphere?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelamento_results: {
        Row: {
          client_id: string
          consulted_at: string
          created_at: string
          data_pedido: string | null
          error_message: string | null
          id: string
          modalidade: string
          modalidade_label: string | null
          numero_parcelamento: string | null
          origem: string
          parcelas_pagas: number | null
          parcelas_total: number | null
          raw_response: Json | null
          situacao: string | null
          status: string
          valor_total: number | null
        }
        Insert: {
          client_id: string
          consulted_at?: string
          created_at?: string
          data_pedido?: string | null
          error_message?: string | null
          id?: string
          modalidade: string
          modalidade_label?: string | null
          numero_parcelamento?: string | null
          origem?: string
          parcelas_pagas?: number | null
          parcelas_total?: number | null
          raw_response?: Json | null
          situacao?: string | null
          status?: string
          valor_total?: number | null
        }
        Update: {
          client_id?: string
          consulted_at?: string
          created_at?: string
          data_pedido?: string | null
          error_message?: string | null
          id?: string
          modalidade?: string
          modalidade_label?: string | null
          numero_parcelamento?: string | null
          origem?: string
          parcelas_pagas?: number | null
          parcelas_total?: number | null
          raw_response?: Json | null
          situacao?: string | null
          status?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          ownership_percentage: number | null
          phone: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          ownership_percentage?: number | null
          phone?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          ownership_percentage?: number | null
          phone?: string | null
          title?: string | null
        }
        Relationships: []
      }
      procurador_tokens: {
        Row: {
          client_cnpj: string
          contratante_cnpj: string
          created_at: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          client_cnpj: string
          contratante_cnpj: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
        }
        Update: {
          client_cnpj?: string
          contratante_cnpj?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      profile_departments: {
        Row: {
          created_at: string
          department_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          full_name: string | null
          id: string
          job_title: string | null
          tag_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          tag_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          tag_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_entries: {
        Row: {
          active: boolean
          amount: number
          bank_account_id: string | null
          category_id: string | null
          client_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          next_run_date: string
          start_date: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          description: string
          end_date?: string | null
          frequency?: string
          id?: string
          next_run_date: string
          start_date: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          next_run_date?: string
          start_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_message_clients: {
        Row: {
          client_id: string
          scheduled_message_id: string
        }
        Insert: {
          client_id: string
          scheduled_message_id: string
        }
        Update: {
          client_id?: string
          scheduled_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_message_clients_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_message_deliveries: {
        Row: {
          chat_message_id: string | null
          client_id: string
          error: string | null
          id: string
          run_id: string
          sent_at: string
          status: string
        }
        Insert: {
          chat_message_id?: string | null
          client_id: string
          error?: string | null
          id?: string
          run_id: string
          sent_at?: string
          status: string
        }
        Update: {
          chat_message_id?: string | null
          client_id?: string
          error?: string | null
          id?: string
          run_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_message_deliveries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scheduled_message_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_message_runs: {
        Row: {
          created_at: string
          id: string
          run_at: string
          scheduled_message_id: string
          status_summary: Json
        }
        Insert: {
          created_at?: string
          id?: string
          run_at?: string
          scheduled_message_id: string
          status_summary?: Json
        }
        Update: {
          created_at?: string
          id?: string
          run_at?: string
          scheduled_message_id?: string
          status_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_message_runs_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          active: boolean
          annual_month: number | null
          anticipate_weekend: boolean
          assignment_mode: string
          attachment_mime: string | null
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          created_by: string | null
          custom_months: number[] | null
          department_id: string
          end_date: string | null
          id: string
          last_run_at: string | null
          message_body: string
          monthly_day: number | null
          name: string
          next_run_at: string | null
          recurrence: string
          segment_filters: Json
          send_time: string
          start_date: string | null
          updated_at: string
          weekly_day: number | null
        }
        Insert: {
          active?: boolean
          annual_month?: number | null
          anticipate_weekend?: boolean
          assignment_mode?: string
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_months?: number[] | null
          department_id: string
          end_date?: string | null
          id?: string
          last_run_at?: string | null
          message_body: string
          monthly_day?: number | null
          name: string
          next_run_at?: string | null
          recurrence?: string
          segment_filters?: Json
          send_time?: string
          start_date?: string | null
          updated_at?: string
          weekly_day?: number | null
        }
        Update: {
          active?: boolean
          annual_month?: number | null
          anticipate_weekend?: boolean
          assignment_mode?: string
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_months?: number[] | null
          department_id?: string
          end_date?: string | null
          id?: string
          last_run_at?: string | null
          message_body?: string
          monthly_day?: number | null
          name?: string
          next_run_at?: string | null
          recurrence?: string
          segment_filters?: Json
          send_time?: string
          start_date?: string | null
          updated_at?: string
          weekly_day?: number | null
        }
        Relationships: []
      }
      service_takers: {
        Row: {
          company_name: string
          created_at: string | null
          document: string
          email: string | null
          id: string
          municipal_registration: string | null
          municipality_code: string | null
          neighborhood: string | null
          number: string | null
          phone: string | null
          street: string | null
          uf: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          company_name: string
          created_at?: string | null
          document: string
          email?: string | null
          id?: string
          municipal_registration?: string | null
          municipality_code?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          street?: string | null
          uf?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          document?: string
          email?: string | null
          id?: string
          municipal_registration?: string | null
          municipality_code?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          street?: string | null
          uf?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      simples_nacional_competencias: {
        Row: {
          ano: number
          client_id: string
          competencia: string
          comprovante_pdf_base64: string | null
          created_at: string
          das_pdf_base64: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          declaracao_pdf_base64: string | null
          id: string
          last_synced_at: string | null
          numero_das: string | null
          numero_declaracao: string | null
          raw_response: Json | null
          rba_acumulado_ano: number | null
          rbt12: number | null
          status: string
          updated_at: string
          valor_das: number | null
        }
        Insert: {
          ano: number
          client_id: string
          competencia: string
          comprovante_pdf_base64?: string | null
          created_at?: string
          das_pdf_base64?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          declaracao_pdf_base64?: string | null
          id?: string
          last_synced_at?: string | null
          numero_das?: string | null
          numero_declaracao?: string | null
          raw_response?: Json | null
          rba_acumulado_ano?: number | null
          rbt12?: number | null
          status?: string
          updated_at?: string
          valor_das?: number | null
        }
        Update: {
          ano?: number
          client_id?: string
          competencia?: string
          comprovante_pdf_base64?: string | null
          created_at?: string
          das_pdf_base64?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          declaracao_pdf_base64?: string | null
          id?: string
          last_synced_at?: string | null
          numero_das?: string | null
          numero_declaracao?: string | null
          raw_response?: Json | null
          rba_acumulado_ano?: number | null
          rbt12?: number | null
          status?: string
          updated_at?: string
          valor_das?: number | null
        }
        Relationships: []
      }
      sitfis_results: {
        Row: {
          client_id: string
          consulted_at: string
          error_message: string | null
          id: string
          pdf_base64: string | null
          pendency_types: string[]
          raw_response: Json | null
          status: string
        }
        Insert: {
          client_id: string
          consulted_at?: string
          error_message?: string | null
          id?: string
          pdf_base64?: string | null
          pendency_types?: string[]
          raw_response?: Json | null
          status?: string
        }
        Update: {
          client_id?: string
          consulted_at?: string
          error_message?: string | null
          id?: string
          pdf_base64?: string | null
          pendency_types?: string[]
          raw_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitfis_results_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          direction: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_due_days: number
          department_id: string
          description: string | null
          id: string
          name: string
          notify_email: boolean
          notify_email_subject: string | null
          notify_message: string | null
          notify_whatsapp: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_due_days?: number
          department_id: string
          description?: string | null
          id?: string
          name: string
          notify_email?: boolean
          notify_email_subject?: string | null
          notify_message?: string | null
          notify_whatsapp?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_due_days?: number
          department_id?: string
          description?: string | null
          id?: string
          name?: string
          notify_email?: boolean
          notify_email_subject?: string | null
          notify_message?: string | null
          notify_whatsapp?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          notify_email: boolean
          notify_email_subject: string | null
          notify_message: string | null
          notify_sent_at: string | null
          notify_whatsapp: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          task_number: number
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notify_email?: boolean
          notify_email_subject?: string | null
          notify_message?: string | null
          notify_sent_at?: string | null
          notify_whatsapp?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_number?: number
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notify_email?: boolean
          notify_email_subject?: string | null
          notify_message?: string | null
          notify_sent_at?: string | null
          notify_whatsapp?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_number?: number
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      triage_learnings: {
        Row: {
          chosen_department_id: string | null
          confirmed_at: string | null
          conversation_id: string | null
          corrected_department_id: string | null
          created_at: string
          id: string
          outcome: string
          summary: string | null
          user_messages: string
        }
        Insert: {
          chosen_department_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          corrected_department_id?: string | null
          created_at?: string
          id?: string
          outcome?: string
          summary?: string | null
          user_messages: string
        }
        Update: {
          chosen_department_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          corrected_department_id?: string | null
          created_at?: string
          id?: string
          outcome?: string
          summary?: string | null
          user_messages?: string
        }
        Relationships: []
      }
      user_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          activity_id: string | null
          body_text: string | null
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          instance_id: string | null
          media_filename: string | null
          obligation_id: string | null
          recipient_phone: string
          sent_at: string
          sent_by: string | null
          status: string
          template_name: string | null
          template_params: Json | null
          wamid: string | null
        }
        Insert: {
          activity_id?: string | null
          body_text?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string | null
          media_filename?: string | null
          obligation_id?: string | null
          recipient_phone: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          wamid?: string | null
        }
        Update: {
          activity_id?: string | null
          body_text?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string | null
          media_filename?: string | null
          obligation_id?: string | null
          recipient_phone?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          template_name?: string | null
          template_params?: Json | null
          wamid?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_conversation_cascade: {
        Args: { p_id: string }
        Returns: undefined
      }
      get_chat_inbox: {
        Args: { p_tab: string; p_user: string }
        Returns: {
          assigned_to: string
          assigned_to_color: string
          assigned_to_name: string
          avatar_url: string
          awaiting_first_reply: boolean
          client_id: string
          created_at: string
          id: string
          is_group: boolean
          last_message: string
          last_message_at: string
          last_message_type: string
          name: string
          status: string
          total_wait_seconds: number
          unread_count: number
          updated_at: string
          waiting_since: string
          whatsapp_phone: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_obligation_instance_status: {
        Args: { _instance_id: string }
        Returns: undefined
      }
      user_can_access_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "document" | "checklist" | "whatsapp" | "email"
      app_role: "admin" | "employee"
      client_status: "active" | "inactive" | "churned"
      financial_entry_status: "pending" | "paid" | "overdue"
      financial_entry_type: "receivable" | "payable"
      obligation_status: "pending" | "in_progress" | "done"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "in_review" | "done"
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
      activity_type: ["document", "checklist", "whatsapp", "email"],
      app_role: ["admin", "employee"],
      client_status: ["active", "inactive", "churned"],
      financial_entry_status: ["pending", "paid", "overdue"],
      financial_entry_type: ["receivable", "payable"],
      obligation_status: ["pending", "in_progress", "done"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "in_review", "done"],
    },
  },
} as const
