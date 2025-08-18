export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      abacatepay_transactions: {
        Row: {
          abacatepay_data: Json | null
          amount_cents: number
          checkout_url: string | null
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          paid_at: string | null
          payment_method: string
          pix_code: string | null
          plan_type: string
          qr_code_url: string | null
          status: string
          transaction_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abacatepay_data?: Json | null
          amount_cents: number
          checkout_url?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method: string
          pix_code?: string | null
          plan_type: string
          qr_code_url?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abacatepay_data?: Json | null
          amount_cents?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string
          pix_code?: string | null
          plan_type?: string
          qr_code_url?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_analytics_events: {
        Row: {
          amount_cents: number | null
          currency: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          currency?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          currency?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_campaigns: {
        Row: {
          coupon_code: string | null
          created_at: string | null
          created_by: string | null
          current_usage: number | null
          description: string | null
          discount_percentage: number
          end_date: string
          id: string
          name: string
          start_date: string
          status: string | null
          target_audience: Json | null
          updated_at: string | null
          usage_limit: number | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string | null
          created_by?: string | null
          current_usage?: number | null
          description?: string | null
          discount_percentage: number
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string | null
          target_audience?: Json | null
          updated_at?: string | null
          usage_limit?: number | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string | null
          created_by?: string | null
          current_usage?: number | null
          description?: string | null
          discount_percentage?: number
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string | null
          target_audience?: Json | null
          updated_at?: string | null
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_payment_configs: {
        Row: {
          abacatepay_metadata: Json | null
          abacatepay_product_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          discount_percentage: number | null
          id: string
          payment_provider: string | null
          plan_type: string
          price_cents: number
          status: string | null
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          abacatepay_metadata?: Json | null
          abacatepay_product_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency: string
          discount_percentage?: number | null
          id?: string
          payment_provider?: string | null
          plan_type: string
          price_cents: number
          status?: string | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          abacatepay_metadata?: Json | null
          abacatepay_product_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          discount_percentage?: number | null
          id?: string
          payment_provider?: string | null
          plan_type?: string
          price_cents?: number
          status?: string | null
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_payment_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_plan_features: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          feature_description: string
          feature_name: string
          id: string
          is_enabled: boolean
          plan_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          feature_description: string
          feature_name: string
          id?: string
          is_enabled?: boolean
          plan_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          feature_description?: string
          feature_name?: string
          id?: string
          is_enabled?: boolean
          plan_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_plan_features_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_stripe_configs: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string
          environment: string
          id: string
          publishable_key: string
          status: string | null
          updated_at: string | null
          webhook_endpoint: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency: string
          environment: string
          id?: string
          publishable_key: string
          status?: string | null
          updated_at?: string | null
          webhook_endpoint?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          environment?: string
          id?: string
          publishable_key?: string
          status?: string | null
          updated_at?: string | null
          webhook_endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_stripe_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          access_level: Database["public"]["Enums"]["app_role"] | null
          application_password: string
          base_url: string
          components_count: number | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          is_active: boolean
          json_field: string
          last_tested: string | null
          name: string
          post_type: string
          preview_field: string
          status: string
          updated_at: string
          user_type: string
          username: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["app_role"] | null
          application_password: string
          base_url: string
          components_count?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          is_active?: boolean
          json_field?: string
          last_tested?: string | null
          name: string
          post_type?: string
          preview_field?: string
          status?: string
          updated_at?: string
          user_type?: string
          username: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["app_role"] | null
          application_password?: string
          base_url?: string
          components_count?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          is_active?: boolean
          json_field?: string
          last_tested?: string | null
          name?: string
          post_type?: string
          preview_field?: string
          status?: string
          updated_at?: string
          user_type?: string
          username?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          access_level: Database["public"]["Enums"]["app_role"]
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          duration: string | null
          id: string
          is_active: boolean
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_url: string
          youtube_video_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["app_role"]
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          duration?: string | null
          id?: string
          is_active?: boolean
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          youtube_url: string
          youtube_video_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["app_role"]
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          duration?: string | null
          id?: string
          is_active?: boolean
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_url?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "free" | "pro" | "admin"
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
      app_role: ["free", "pro", "admin"],
    },
  },
} as const
