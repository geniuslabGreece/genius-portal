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
      contracts: {
        Row: {
          contract_number: string
          created_at: string
          customer_id: string
          end_date: string
          id: string
          locked_from_sync: boolean
          notes: string | null
          product_id: string
          quantity: number
          renewal_months: number
          source: Database["public"]["Enums"]["contract_source"]
          start_date: string
          unit: string
          updated_at: string
        }
        Insert: {
          contract_number: string
          created_at?: string
          customer_id: string
          end_date: string
          id?: string
          locked_from_sync?: boolean
          notes?: string | null
          product_id: string
          quantity?: number
          renewal_months?: number
          source?: Database["public"]["Enums"]["contract_source"]
          start_date: string
          unit?: string
          updated_at?: string
        }
        Update: {
          contract_number?: string
          created_at?: string
          customer_id?: string
          end_date?: string
          id?: string
          locked_from_sync?: boolean
          notes?: string | null
          product_id?: string
          quantity?: number
          renewal_months?: number
          source?: Database["public"]["Enums"]["contract_source"]
          start_date?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_azure_ad_devices: {
        Row: {
          account_enabled: boolean | null
          approximate_last_sign_in: string | null
          azure_device_id: string
          customer_id: string
          display_name: string | null
          id: string
          is_compliant: boolean | null
          is_managed: boolean | null
          join_type: string | null
          last_synced_at: string
          operating_system: string | null
          operating_system_version: string | null
          registration_datetime: string | null
          trust_type: string | null
        }
        Insert: {
          account_enabled?: boolean | null
          approximate_last_sign_in?: string | null
          azure_device_id: string
          customer_id: string
          display_name?: string | null
          id?: string
          is_compliant?: boolean | null
          is_managed?: boolean | null
          join_type?: string | null
          last_synced_at?: string
          operating_system?: string | null
          operating_system_version?: string | null
          registration_datetime?: string | null
          trust_type?: string | null
        }
        Update: {
          account_enabled?: boolean | null
          approximate_last_sign_in?: string | null
          azure_device_id?: string
          customer_id?: string
          display_name?: string | null
          id?: string
          is_compliant?: boolean | null
          is_managed?: boolean | null
          join_type?: string | null
          last_synced_at?: string
          operating_system?: string | null
          operating_system_version?: string | null
          registration_datetime?: string | null
          trust_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_azure_ad_devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_azure_ad_licenses: {
        Row: {
          applies_to: string | null
          capability_status: string | null
          consumed_units: number | null
          customer_id: string
          display_name: string | null
          id: string
          last_synced_at: string
          prepaid_enabled: number | null
          prepaid_suspended: number | null
          prepaid_warning: number | null
          sku_id: string
          sku_part_number: string | null
        }
        Insert: {
          applies_to?: string | null
          capability_status?: string | null
          consumed_units?: number | null
          customer_id: string
          display_name?: string | null
          id?: string
          last_synced_at?: string
          prepaid_enabled?: number | null
          prepaid_suspended?: number | null
          prepaid_warning?: number | null
          sku_id: string
          sku_part_number?: string | null
        }
        Update: {
          applies_to?: string | null
          capability_status?: string | null
          consumed_units?: number | null
          customer_id?: string
          display_name?: string | null
          id?: string
          last_synced_at?: string
          prepaid_enabled?: number | null
          prepaid_suspended?: number | null
          prepaid_warning?: number | null
          sku_id?: string
          sku_part_number?: string | null
        }
        Relationships: []
      }
      customer_azure_ad_settings: {
        Row: {
          client_id: string
          client_secret_enc: string | null
          created_at: string
          customer_id: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret_enc?: string | null
          created_at?: string
          customer_id: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret_enc?: string | null
          created_at?: string
          customer_id?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_azure_ad_settings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_azure_ad_sync_logs: {
        Row: {
          action: string
          copilot_synced: number | null
          created_at: string
          customer_id: string
          devices_synced: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          licenses_synced: number | null
          status: string
          triggered_by: string | null
          users_synced: number | null
        }
        Insert: {
          action: string
          copilot_synced?: number | null
          created_at?: string
          customer_id: string
          devices_synced?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          licenses_synced?: number | null
          status: string
          triggered_by?: string | null
          users_synced?: number | null
        }
        Update: {
          action?: string
          copilot_synced?: number | null
          created_at?: string
          customer_id?: string
          devices_synced?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          licenses_synced?: number | null
          status?: string
          triggered_by?: string | null
          users_synced?: number | null
        }
        Relationships: []
      }
      customer_azure_ad_users: {
        Row: {
          account_enabled: boolean | null
          azure_object_id: string
          customer_id: string
          display_name: string | null
          id: string
          job_title: string | null
          last_synced_at: string
          mail: string | null
          user_principal_name: string | null
        }
        Insert: {
          account_enabled?: boolean | null
          azure_object_id: string
          customer_id: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          last_synced_at?: string
          mail?: string | null
          user_principal_name?: string | null
        }
        Update: {
          account_enabled?: boolean | null
          azure_object_id?: string
          customer_id?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          last_synced_at?: string
          mail?: string | null
          user_principal_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_azure_ad_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_copilot_usage: {
        Row: {
          assigned_sku: string | null
          copilot_chat_last_activity: string | null
          created_at: string
          customer_id: string
          display_name: string | null
          excel_copilot_last_activity: string | null
          has_assigned_license: boolean | null
          id: string
          last_activity_date: string | null
          last_synced_at: string
          loop_copilot_last_activity: string | null
          microsoft_teams_copilot_last_activity: string | null
          onenote_copilot_last_activity: string | null
          outlook_copilot_last_activity: string | null
          period_days: number | null
          powerpoint_copilot_last_activity: string | null
          user_principal_name: string
          word_copilot_last_activity: string | null
        }
        Insert: {
          assigned_sku?: string | null
          copilot_chat_last_activity?: string | null
          created_at?: string
          customer_id: string
          display_name?: string | null
          excel_copilot_last_activity?: string | null
          has_assigned_license?: boolean | null
          id?: string
          last_activity_date?: string | null
          last_synced_at?: string
          loop_copilot_last_activity?: string | null
          microsoft_teams_copilot_last_activity?: string | null
          onenote_copilot_last_activity?: string | null
          outlook_copilot_last_activity?: string | null
          period_days?: number | null
          powerpoint_copilot_last_activity?: string | null
          user_principal_name: string
          word_copilot_last_activity?: string | null
        }
        Update: {
          assigned_sku?: string | null
          copilot_chat_last_activity?: string | null
          created_at?: string
          customer_id?: string
          display_name?: string | null
          excel_copilot_last_activity?: string | null
          has_assigned_license?: boolean | null
          id?: string
          last_activity_date?: string | null
          last_synced_at?: string
          loop_copilot_last_activity?: string | null
          microsoft_teams_copilot_last_activity?: string | null
          onenote_copilot_last_activity?: string | null
          outlook_copilot_last_activity?: string | null
          period_days?: number | null
          powerpoint_copilot_last_activity?: string | null
          user_principal_name?: string
          word_copilot_last_activity?: string | null
        }
        Relationships: []
      }
      customer_email_domains: {
        Row: {
          created_at: string
          customer_id: string
          domain: string
          id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          domain: string
          id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          domain?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_email_domains_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_manager_email: string | null
          account_manager_name: string | null
          account_manager_phone: string | null
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          softone_id: string | null
          status: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          account_manager_email?: string | null
          account_manager_name?: string | null
          account_manager_phone?: string | null
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          softone_id?: string | null
          status?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          account_manager_email?: string | null
          account_manager_name?: string | null
          account_manager_phone?: string | null
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          softone_id?: string | null
          status?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      mail_server_settings: {
        Row: {
          created_at: string
          enabled: boolean
          from_email: string | null
          from_name: string | null
          id: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_status: string | null
          oauth_client_id: string | null
          oauth_client_secret: string | null
          oauth_refresh_token: string | null
          oauth_tenant_id: string | null
          provider: string
          reply_to: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean
          smtp_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          from_email?: string | null
          from_name?: string | null
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          oauth_refresh_token?: string | null
          oauth_tenant_id?: string | null
          provider?: string
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          from_email?: string | null
          from_name?: string | null
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          oauth_refresh_token?: string | null
          oauth_tenant_id?: string | null
          provider?: string
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          contract_id: string | null
          created_at: string
          customer_id: string
          id: string
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body: string
          contract_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string
          contract_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          name: string
          sku: string | null
          softone_code: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sku?: string | null
          softone_code?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sku?: string | null
          softone_code?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          customer_id: string | null
          email: string
          full_name: string | null
          id: string
          provider: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          customer_id?: string | null
          email: string
          full_name?: string | null
          id: string
          provider?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      softone_settings: {
        Row: {
          app_id: string | null
          branch: string | null
          company: string | null
          contracts_sql: string | null
          created_at: string
          customers_sql: string | null
          deployment_type: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          last_sync_message: string | null
          last_sync_status: string | null
          module: string | null
          password: string | null
          products_sql: string | null
          refid: string | null
          service_url: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          app_id?: string | null
          branch?: string | null
          company?: string | null
          contracts_sql?: string | null
          created_at?: string
          customers_sql?: string | null
          deployment_type?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_message?: string | null
          last_sync_status?: string | null
          module?: string | null
          password?: string | null
          products_sql?: string | null
          refid?: string | null
          service_url?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          app_id?: string | null
          branch?: string | null
          company?: string | null
          contracts_sql?: string | null
          created_at?: string
          customers_sql?: string | null
          deployment_type?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_message?: string | null
          last_sync_status?: string | null
          module?: string | null
          password?: string | null
          products_sql?: string | null
          refid?: string | null
          service_url?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      softone_sync_logs: {
        Row: {
          contracts_synced: number | null
          created_at: string
          customers_synced: number | null
          duration_ms: number | null
          errors_count: number | null
          id: string
          message: string | null
          products_synced: number | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          contracts_synced?: number | null
          created_at?: string
          customers_synced?: number | null
          duration_ms?: number | null
          errors_count?: number | null
          id?: string
          message?: string | null
          products_synced?: number | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          contracts_synced?: number | null
          created_at?: string
          customers_synced?: number | null
          duration_ms?: number | null
          errors_count?: number | null
          id?: string
          message?: string | null
          products_synced?: number | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      ticket_department_settings: {
        Row: {
          department: Database["public"]["Enums"]["ticket_department"]
          description: string | null
          display_name: string
          notify_email: string | null
          updated_at: string
        }
        Insert: {
          department: Database["public"]["Enums"]["ticket_department"]
          description?: string | null
          display_name: string
          notify_email?: string | null
          updated_at?: string
        }
        Update: {
          department?: Database["public"]["Enums"]["ticket_department"]
          description?: string | null
          display_name?: string
          notify_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_type: Database["public"]["Enums"]["ticket_message_author"]
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_type: Database["public"]["Enums"]["ticket_message_author"]
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_type?: Database["public"]["Enums"]["ticket_message_author"]
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          ai_chat_summary: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          customer_id: string
          department: Database["public"]["Enums"]["ticket_department"]
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: number
          updated_at: string
        }
        Insert: {
          ai_chat_summary?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          department: Database["public"]["Enums"]["ticket_department"]
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          ai_chat_summary?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          department?: Database["public"]["Enums"]["ticket_department"]
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_customer_admins: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      current_user_customer_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_customer_admin_for: {
        Args: { _customer_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer_admin" | "customer_user"
      contract_source: "manual" | "import" | "softone_sync"
      notification_type:
        | "expiring_60"
        | "expiring_30"
        | "expiring_7"
        | "expired"
        | "general"
      product_category: "software" | "hardware" | "erp" | "devices"
      ticket_department:
        | "technical"
        | "software"
        | "erp"
        | "hardware"
        | "devices"
      ticket_message_author: "customer" | "admin" | "ai_bot" | "system"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
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
      app_role: ["admin", "customer_admin", "customer_user"],
      contract_source: ["manual", "import", "softone_sync"],
      notification_type: [
        "expiring_60",
        "expiring_30",
        "expiring_7",
        "expired",
        "general",
      ],
      product_category: ["software", "hardware", "erp", "devices"],
      ticket_department: [
        "technical",
        "software",
        "erp",
        "hardware",
        "devices",
      ],
      ticket_message_author: ["customer", "admin", "ai_bot", "system"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
