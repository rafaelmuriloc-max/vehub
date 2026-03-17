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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
      clients: {
        Row: {
          address: string | null
          business_segment: string | null
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
          start_date: string | null
          state_registration: string | null
          status: Database["public"]["Enums"]["client_status"]
          success_notes: string | null
          tax_regime: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_segment?: string | null
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
          start_date?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          success_notes?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_segment?: string | null
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
          start_date?: string | null
          state_registration?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          success_notes?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
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
      financial_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["financial_entry_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["financial_entry_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["financial_entry_type"]
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          paid_date: string | null
          status: Database["public"]["Enums"]["financial_entry_status"]
          type: Database["public"]["Enums"]["financial_entry_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          type: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          type?: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string
        }
        Relationships: [
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
        ]
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
      obligation_activities: {
        Row: {
          created_at: string
          description: string | null
          document_type_id: string | null
          id: string
          obligation_id: string
          order: number
          title: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type_id?: string | null
          id?: string
          obligation_id: string
          order?: number
          title: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type_id?: string | null
          id?: string
          obligation_id?: string
          order?: number
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
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
          file_url: string | null
          id: string
          instance_id: string
          notes: string | null
        }
        Insert: {
          activity_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          file_url?: string | null
          id?: string
          instance_id: string
          notes?: string | null
        }
        Update: {
          activity_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          file_url?: string | null
          id?: string
          instance_id?: string
          notes?: string | null
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
          created_at: string
          due_date: string | null
          id: string
          obligation_id: string
          reference_month: string
          status: Database["public"]["Enums"]["obligation_status"]
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          obligation_id: string
          reference_month: string
          status?: Database["public"]["Enums"]["obligation_status"]
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          obligation_id?: string
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
          created_at: string
          department_id: string
          description: string | null
          id: string
          name: string
          recurrence: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          description?: string | null
          id?: string
          name: string
          recurrence?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string | null
          id?: string
          name?: string
          recurrence?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          full_name: string | null
          id: string
          job_title: string | null
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
      tasks: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
