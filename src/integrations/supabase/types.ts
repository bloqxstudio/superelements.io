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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      analytics_config: {
        Row: {
          connection_id: string
          created_at: string | null
          ecommerce_enabled: boolean | null
          ecommerce_platform: string | null
          id: string
          last_synced_at: string | null
          posthog_api_key: string | null
          posthog_enabled: boolean | null
          posthog_project_id: string | null
          sync_frequency_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          ecommerce_enabled?: boolean | null
          ecommerce_platform?: string | null
          id?: string
          last_synced_at?: string | null
          posthog_api_key?: string | null
          posthog_enabled?: boolean | null
          posthog_project_id?: string | null
          sync_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          ecommerce_enabled?: boolean | null
          ecommerce_platform?: string | null
          id?: string
          last_synced_at?: string | null
          posthog_api_key?: string | null
          posthog_enabled?: boolean | null
          posthog_project_id?: string | null
          sync_frequency_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_config_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_config_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_configs: {
        Row: {
          connection_id: string
          created_at: string | null
          id: string
          last_posthog_sync: string | null
          last_woocommerce_sync: string | null
          posthog_api_key: string | null
          posthog_enabled: boolean | null
          posthog_project_id: string | null
          updated_at: string | null
          woocommerce_consumer_key: string | null
          woocommerce_consumer_secret: string | null
          woocommerce_enabled: boolean | null
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          id?: string
          last_posthog_sync?: string | null
          last_woocommerce_sync?: string | null
          posthog_api_key?: string | null
          posthog_enabled?: boolean | null
          posthog_project_id?: string | null
          updated_at?: string | null
          woocommerce_consumer_key?: string | null
          woocommerce_consumer_secret?: string | null
          woocommerce_enabled?: boolean | null
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          id?: string
          last_posthog_sync?: string | null
          last_woocommerce_sync?: string | null
          posthog_api_key?: string | null
          posthog_enabled?: boolean | null
          posthog_project_id?: string | null
          updated_at?: string | null
          woocommerce_consumer_key?: string | null
          woocommerce_consumer_secret?: string | null
          woocommerce_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_configs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_configs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhooks: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed: boolean | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload: Json
          payment_id?: string | null
          processed?: boolean | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean | null
        }
        Relationships: []
      }
      client_page_performance: {
        Row: {
          client_page_id: string | null
          cls: number | null
          connection_id: string | null
          created_at: string
          fetched_at: string
          id: string
          inp_ms: number | null
          lcp_ms: number | null
          performance_score: number | null
          raw_result: Json | null
          report_url: string | null
          strategy: string
          tbt_ms: number | null
          updated_at: string
          url: string
        }
        Insert: {
          client_page_id?: string | null
          cls?: number | null
          connection_id?: string | null
          created_at?: string
          fetched_at?: string
          id?: string
          inp_ms?: number | null
          lcp_ms?: number | null
          performance_score?: number | null
          raw_result?: Json | null
          report_url?: string | null
          strategy: string
          tbt_ms?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          client_page_id?: string | null
          cls?: number | null
          connection_id?: string | null
          created_at?: string
          fetched_at?: string
          id?: string
          inp_ms?: number | null
          lcp_ms?: number | null
          performance_score?: number | null
          raw_result?: Json | null
          report_url?: string | null
          strategy?: string
          tbt_ms?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_page_performance_client_page_id_fkey"
            columns: ["client_page_id"]
            isOneToOne: false
            referencedRelation: "client_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_page_performance_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_page_performance_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      client_page_recommendations: {
        Row: {
          client_page_id: string
          connection_id: string | null
          created_at: string
          full_analysis: Json
          generated_at: string
          id: string
          model: string | null
          performance_id: string | null
          priority_actions: Json
          quick_wins: Json
          risk_notes: Json
          strategy: string
          summary: string
          updated_at: string
          wordpress_focus: Json
        }
        Insert: {
          client_page_id: string
          connection_id?: string | null
          created_at?: string
          full_analysis?: Json
          generated_at?: string
          id?: string
          model?: string | null
          performance_id?: string | null
          priority_actions?: Json
          quick_wins?: Json
          risk_notes?: Json
          strategy: string
          summary?: string
          updated_at?: string
          wordpress_focus?: Json
        }
        Update: {
          client_page_id?: string
          connection_id?: string | null
          created_at?: string
          full_analysis?: Json
          generated_at?: string
          id?: string
          model?: string | null
          performance_id?: string | null
          priority_actions?: Json
          quick_wins?: Json
          risk_notes?: Json
          strategy?: string
          summary?: string
          updated_at?: string
          wordpress_focus?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_page_recommendations_client_page_id_fkey"
            columns: ["client_page_id"]
            isOneToOne: false
            referencedRelation: "client_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_page_recommendations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_page_recommendations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_page_recommendations_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "client_page_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pages: {
        Row: {
          connection_id: string
          created_at: string | null
          id: string
          imported_at: string | null
          last_synced: string | null
          modified_date: string | null
          slug: string
          status: string
          title: string
          updated_at: string | null
          url: string
          wordpress_page_id: number
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          last_synced?: string | null
          modified_date?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string | null
          url: string
          wordpress_page_id: number
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          id?: string
          imported_at?: string | null
          last_synced?: string | null
          modified_date?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string | null
          url?: string
          wordpress_page_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_credentials: {
        Row: {
          application_password: string
          connection_id: string
          created_at: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          application_password: string
          connection_id: string
          created_at?: string
          id?: string
          updated_at?: string
          username: string
        }
        Update: {
          application_password?: string
          connection_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          access_level: Database["public"]["Enums"]["app_role"] | null
          base_url: string
          components_count: number | null
          connection_type: string | null
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
          slug: string | null
          status: string
          updated_at: string
          user_type: string
          workspace_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["app_role"] | null
          base_url: string
          components_count?: number | null
          connection_type?: string | null
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
          slug?: string | null
          status?: string
          updated_at?: string
          user_type?: string
          workspace_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["app_role"] | null
          base_url?: string
          components_count?: number | null
          connection_type?: string | null
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
          slug?: string | null
          status?: string
          updated_at?: string
          user_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_snapshots: {
        Row: {
          average_order_value: number | null
          completed_orders: number | null
          connection_id: string
          created_at: string | null
          failed_orders: number | null
          id: string
          new_customers: number | null
          out_of_stock_products: number | null
          pending_orders: number | null
          period_type: string
          raw_data: Json | null
          refunded_orders: number | null
          snapshot_date: string
          top_categories: Json | null
          top_products: Json | null
          total_customers: number | null
          total_orders: number | null
          total_products: number | null
          total_sales: number | null
        }
        Insert: {
          average_order_value?: number | null
          completed_orders?: number | null
          connection_id: string
          created_at?: string | null
          failed_orders?: number | null
          id?: string
          new_customers?: number | null
          out_of_stock_products?: number | null
          pending_orders?: number | null
          period_type: string
          raw_data?: Json | null
          refunded_orders?: number | null
          snapshot_date: string
          top_categories?: Json | null
          top_products?: Json | null
          total_customers?: number | null
          total_orders?: number | null
          total_products?: number | null
          total_sales?: number | null
        }
        Update: {
          average_order_value?: number | null
          completed_orders?: number | null
          connection_id?: string
          created_at?: string | null
          failed_orders?: number | null
          id?: string
          new_customers?: number | null
          out_of_stock_products?: number | null
          pending_orders?: number | null
          period_type?: string
          raw_data?: Json | null
          refunded_orders?: number | null
          snapshot_date?: string
          top_categories?: Json | null
          top_products?: Json | null
          total_customers?: number | null
          total_orders?: number | null
          total_products?: number | null
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_snapshots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_snapshots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      figma_conversions: {
        Row: {
          component_id: number
          component_url: string
          conversion_metadata: Json | null
          created_at: string | null
          figma_data: Json
          html_hash: string
          id: string
          last_used_at: string | null
          use_count: number | null
        }
        Insert: {
          component_id: number
          component_url: string
          conversion_metadata?: Json | null
          created_at?: string | null
          figma_data: Json
          html_hash: string
          id?: string
          last_used_at?: string | null
          use_count?: number | null
        }
        Update: {
          component_id?: number
          component_url?: string
          conversion_metadata?: Json | null
          created_at?: string | null
          figma_data?: Json
          html_hash?: string
          id?: string
          last_used_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      page_analytics: {
        Row: {
          avg_time_on_page: number | null
          bounce_rate: number | null
          connection_id: string
          created_at: string | null
          custom_events: Json | null
          date: string
          id: string
          page_title: string | null
          page_type: string | null
          page_url: string
          pageviews: number | null
          raw_posthog_data: Json | null
          sessions: number | null
          traffic_sources: Json | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          avg_time_on_page?: number | null
          bounce_rate?: number | null
          connection_id: string
          created_at?: string | null
          custom_events?: Json | null
          date: string
          id?: string
          page_title?: string | null
          page_type?: string | null
          page_url: string
          pageviews?: number | null
          raw_posthog_data?: Json | null
          sessions?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_time_on_page?: number | null
          bounce_rate?: number | null
          connection_id?: string
          created_at?: string | null
          custom_events?: Json | null
          date?: string
          id?: string
          page_title?: string | null
          page_type?: string | null
          page_url?: string
          pageviews?: number | null
          raw_posthog_data?: Json | null
          sessions?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_analytics_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_analytics_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount: number
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          billing_type: string
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          plan_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_type: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      posthog_stats: {
        Row: {
          avg_session_duration: number | null
          bounce_rate: number | null
          connection_id: string
          created_at: string | null
          devices: Json | null
          id: string
          pageviews_by_day: Json | null
          period_end: string
          period_start: string
          top_pages: Json | null
          total_pageviews: number | null
          total_sessions: number | null
          traffic_sources: Json | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          avg_session_duration?: number | null
          bounce_rate?: number | null
          connection_id: string
          created_at?: string | null
          devices?: Json | null
          id?: string
          pageviews_by_day?: Json | null
          period_end: string
          period_start: string
          top_pages?: Json | null
          total_pageviews?: number | null
          total_sessions?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_session_duration?: number | null
          bounce_rate?: number | null
          connection_id?: string
          created_at?: string | null
          devices?: Json | null
          id?: string
          pageviews_by_day?: Json | null
          period_end?: string
          period_start?: string
          top_pages?: Json | null
          total_pageviews?: number | null
          total_sessions?: number | null
          traffic_sources?: Json | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posthog_stats_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posthog_stats_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          created_at: string
          email: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          created_at?: string
          email: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          accepted_at: string | null
          client_email: string | null
          client_name: string
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          payment_terms: string | null
          price: number
          scope: string
          status: string
          template: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          payment_terms?: string | null
          price: number
          scope: string
          status?: string
          template?: string
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          payment_terms?: string | null
          price?: number
          scope?: string
          status?: string
          template?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_size: string | null
          icon: string | null
          id: string
          is_active: boolean
          order: number
          title: string
          type: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          order?: number
          title: string
          type: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          order?: number
          title?: string
          type?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      woocommerce_stats: {
        Row: {
          average_order_value: number | null
          connection_id: string
          created_at: string | null
          id: string
          orders_by_status: Json | null
          period_end: string
          period_start: string
          sales_by_day: Json | null
          top_products: Json | null
          total_customers: number | null
          total_orders: number | null
          total_products: number | null
          total_sales: number | null
          updated_at: string | null
        }
        Insert: {
          average_order_value?: number | null
          connection_id: string
          created_at?: string | null
          id?: string
          orders_by_status?: Json | null
          period_end: string
          period_start: string
          sales_by_day?: Json | null
          top_products?: Json | null
          total_customers?: number | null
          total_orders?: number | null
          total_products?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Update: {
          average_order_value?: number | null
          connection_id?: string
          created_at?: string | null
          id?: string
          orders_by_status?: Json | null
          period_end?: string
          period_start?: string
          sales_by_day?: Json | null
          top_products?: Json | null
          total_customers?: number | null
          total_orders?: number | null
          total_products?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_stats_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woocommerce_stats_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      figma_conversion_stats: {
        Row: {
          cache_hit_rate: number | null
          cache_hits: number | null
          total_conversions: number | null
          total_uses: number | null
        }
        Relationships: []
      }
      shared_connections: {
        Row: {
          base_url: string | null
          components_count: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          json_field: string | null
          name: string | null
          post_type: string | null
          preview_field: string | null
          status: string | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          base_url?: string | null
          components_count?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          json_field?: string | null
          name?: string | null
          post_type?: string | null
          preview_field?: string | null
          status?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          base_url?: string | null
          components_count?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          json_field?: string | null
          name?: string | null
          post_type?: string | null
          preview_field?: string | null
          status?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
      process_payment_webhook: {
        Args: { payment_id_param: string; payment_status: string }
        Returns: undefined
      }
      public_set_proposal_status_by_token: {
        Args: { p_status: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "free" | "pro" | "admin"
      workspace_role: "owner" | "member" | "manager"
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
      workspace_role: ["owner", "member", "manager"],
    },
  },
} as const
