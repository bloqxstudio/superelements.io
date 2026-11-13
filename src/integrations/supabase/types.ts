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
    PostgrestVersion: "12.2.3"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
      crm_account_context: {
        Row: {
          audience: string
          brand_md: string
          goal: string
          offer: string
          pillars: Json
          restrictions: string
          team_id: string
          tone: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          audience?: string
          brand_md?: string
          goal?: string
          offer?: string
          pillars?: Json
          restrictions?: string
          team_id: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          audience?: string
          brand_md?: string
          goal?: string
          offer?: string
          pillars?: Json
          restrictions?: string
          team_id?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_account_context_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_account_context_versions: {
        Row: {
          payload: Json
          saved_at: string
          saved_by: string | null
          team_id: string
          version: number
        }
        Insert: {
          payload: Json
          saved_at?: string
          saved_by?: string | null
          team_id: string
          version: number
        }
        Update: {
          payload?: Json
          saved_at?: string
          saved_by?: string | null
          team_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_account_context_versions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          data: Json
          id: string
          kind: string
          opportunity_id: string | null
          team_id: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          kind?: string
          opportunity_id?: string | null
          team_id: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          kind?: string
          opportunity_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_accounts: {
        Row: {
          account_status: number | null
          ad_account_id: string
          business_name: string | null
          connected_at: string
          connected_by: string | null
          connected_name: string | null
          created_at: string
          currency: string
          id: string
          name: string
          scopes: string[] | null
          sync_error: string | null
          synced_at: string | null
          team_id: string
          timezone_name: string | null
          token_expires_at: string | null
          token_kind: string | null
          updated_at: string
        }
        Insert: {
          account_status?: number | null
          ad_account_id: string
          business_name?: string | null
          connected_at?: string
          connected_by?: string | null
          connected_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          scopes?: string[] | null
          sync_error?: string | null
          synced_at?: string | null
          team_id: string
          timezone_name?: string | null
          token_expires_at?: string | null
          token_kind?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: number | null
          ad_account_id?: string
          business_name?: string | null
          connected_at?: string
          connected_by?: string | null
          connected_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          scopes?: string[] | null
          sync_error?: string | null
          synced_at?: string | null
          team_id?: string
          timezone_name?: string | null
          token_expires_at?: string | null
          token_kind?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_accounts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_boosts: {
        Row: {
          account_id: string
          activated_at: string | null
          activated_by: string | null
          ad_id: string
          adset_id: string
          audience: Json
          campaign_id: string
          caption: string | null
          checked_at: string | null
          created_at: string
          created_by: string | null
          creative_id: string
          currency: string
          daily_budget: number
          end_at: string
          goal: string
          id: string
          ig_media_id: string
          ig_user_id: string
          ig_username: string | null
          link: string | null
          meta_feedback: string | null
          meta_status: string | null
          page_id: string
          permalink: string | null
          start_at: string
          status: string
          team_id: string
          thumbnail: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          activated_at?: string | null
          activated_by?: string | null
          ad_id: string
          adset_id: string
          audience?: Json
          campaign_id: string
          caption?: string | null
          checked_at?: string | null
          created_at?: string
          created_by?: string | null
          creative_id: string
          currency?: string
          daily_budget: number
          end_at: string
          goal: string
          id?: string
          ig_media_id: string
          ig_user_id: string
          ig_username?: string | null
          link?: string | null
          meta_feedback?: string | null
          meta_status?: string | null
          page_id: string
          permalink?: string | null
          start_at: string
          status?: string
          team_id: string
          thumbnail?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          activated_at?: string | null
          activated_by?: string | null
          ad_id?: string
          adset_id?: string
          audience?: Json
          campaign_id?: string
          caption?: string | null
          checked_at?: string | null
          created_at?: string
          created_by?: string | null
          creative_id?: string
          currency?: string
          daily_budget?: number
          end_at?: string
          goal?: string
          id?: string
          ig_media_id?: string
          ig_user_id?: string
          ig_username?: string | null
          link?: string | null
          meta_feedback?: string | null
          meta_status?: string | null
          page_id?: string
          permalink?: string | null
          start_at?: string
          status?: string
          team_id?: string
          thumbnail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_boosts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_boosts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_connect_links: {
        Row: {
          account_ids: string[] | null
          connected_at: string | null
          connected_name: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string
          pending_id: string | null
          revoked_at: string | null
          team_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          account_ids?: string[] | null
          connected_at?: string | null
          connected_name?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          label?: string
          pending_id?: string | null
          revoked_at?: string | null
          team_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          account_ids?: string[] | null
          connected_at?: string | null
          connected_name?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string
          pending_id?: string | null
          revoked_at?: string | null
          team_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_connect_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_pending: {
        Row: {
          access_token: string
          accounts: Json
          connected_name: string | null
          id: string
          scopes: string[] | null
          team_id: string
          token_expires_at: string | null
          token_kind: string | null
          user_id: string
          valid_until: string
        }
        Insert: {
          access_token: string
          accounts?: Json
          connected_name?: string | null
          id?: string
          scopes?: string[] | null
          team_id: string
          token_expires_at?: string | null
          token_kind?: string | null
          user_id: string
          valid_until?: string
        }
        Update: {
          access_token?: string
          accounts?: Json
          connected_name?: string | null
          id?: string
          scopes?: string[] | null
          team_id?: string
          token_expires_at?: string | null
          token_kind?: string | null
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_pending_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_reports: {
        Row: {
          account_id: string
          data: Json
          fetched_at: string
          preset: string
          team_id: string
        }
        Insert: {
          account_id: string
          data?: Json
          fetched_at?: string
          preset: string
          team_id: string
        }
        Update: {
          account_id?: string
          data?: Json
          fetched_at?: string
          preset?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_reports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_tokens: {
        Row: {
          access_token: string
          account_id: string
          expires_at: string | null
          issued_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          expires_at?: string | null
          issued_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          expires_at?: string | null
          issued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approval_items: {
        Row: {
          channel: string | null
          content_hash: string
          content_id: string | null
          content_version: number
          created_at: string
          decided_at: string | null
          decided_name: string | null
          decision: string
          editorial_date: string | null
          format: string
          id: string
          kind: string
          link_id: string
          media: Json
          position: number
          post_id: string | null
          scheduled_time: string | null
          script: string
          set_hash: string
          set_id: string | null
          team_id: string
          title: string
        }
        Insert: {
          channel?: string | null
          content_hash: string
          content_id?: string | null
          content_version: number
          created_at?: string
          decided_at?: string | null
          decided_name?: string | null
          decision?: string
          editorial_date?: string | null
          format: string
          id?: string
          kind?: string
          link_id: string
          media?: Json
          position: number
          post_id?: string | null
          scheduled_time?: string | null
          script?: string
          set_hash?: string
          set_id?: string | null
          team_id: string
          title: string
        }
        Update: {
          channel?: string | null
          content_hash?: string
          content_id?: string | null
          content_version?: number
          created_at?: string
          decided_at?: string | null
          decided_name?: string | null
          decision?: string
          editorial_date?: string | null
          format?: string
          id?: string
          kind?: string
          link_id?: string
          media?: Json
          position?: number
          post_id?: string | null
          scheduled_time?: string | null
          script?: string
          set_hash?: string
          set_id?: string | null
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_approval_items_content_id_team_id_fkey"
            columns: ["content_id", "team_id"]
            isOneToOne: false
            referencedRelation: "crm_contents"
            referencedColumns: ["id", "team_id"]
          },
          {
            foreignKeyName: "crm_approval_items_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "crm_approval_links"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_approval_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          ig_username: string | null
          message: string
          revoked_at: string | null
          team_id: string
          team_name: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          ig_username?: string | null
          message?: string
          revoked_at?: string | null
          team_id: string
          team_name: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          ig_username?: string | null
          message?: string
          revoked_at?: string | null
          team_id?: string
          team_name?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_approval_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_boards: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pending: Json
          rev: number
          scene: Json
          team_id: string
          thumb_path: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pending?: Json
          rev?: number
          scene?: Json
          team_id: string
          thumb_path?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pending?: Json
          rev?: number
          scene?: Json
          team_id?: string
          thumb_path?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          document: string | null
          domain: string | null
          email: string | null
          facebook: string | null
          id: string
          instagram: string | null
          lead: Json | null
          linkedin: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          prospect_key: string | null
          segment: string | null
          source: string
          status: string
          team_id: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          domain?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          lead?: Json | null
          linkedin?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          prospect_key?: string | null
          segment?: string | null
          source?: string
          status?: string
          team_id: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          domain?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          lead?: Json | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          prospect_key?: string | null
          segment?: string | null
          source?: string
          status?: string
          team_id?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          team_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          team_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          team_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_content_comments: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          content_id: string | null
          created_at: string
          from_client: boolean
          id: string
          internal: boolean
          item_id: string | null
          post: number | null
          resolved_at: string | null
          resolved_by: string | null
          slide: number | null
          team_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          body: string
          content_id?: string | null
          created_at?: string
          from_client?: boolean
          id?: string
          internal?: boolean
          item_id?: string | null
          post?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          slide?: number | null
          team_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          content_id?: string | null
          created_at?: string
          from_client?: boolean
          id?: string
          internal?: boolean
          item_id?: string | null
          post?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          slide?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_content_comments_content_id_team_id_fkey"
            columns: ["content_id", "team_id"]
            isOneToOne: false
            referencedRelation: "crm_contents"
            referencedColumns: ["id", "team_id"]
          },
          {
            foreignKeyName: "crm_content_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "crm_approval_items"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_content_links: {
        Row: {
          artifact_id: string
          content_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          linked_hash: string
          project_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          artifact_id: string
          content_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          linked_hash?: string
          project_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          artifact_id?: string
          content_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          linked_hash?: string
          project_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_content_links_content_id_team_id_fkey"
            columns: ["content_id", "team_id"]
            isOneToOne: false
            referencedRelation: "crm_contents"
            referencedColumns: ["id", "team_id"]
          },
          {
            foreignKeyName: "crm_content_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "space_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_content_snapshots: {
        Row: {
          content_hash: string
          content_id: string
          content_version: number
          context: Json | null
          context_version: number | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          links: Json
          payload: Json
          team_id: string
        }
        Insert: {
          content_hash: string
          content_id: string
          content_version: number
          context?: Json | null
          context_version?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          links?: Json
          payload: Json
          team_id: string
        }
        Update: {
          content_hash?: string
          content_id?: string
          content_version?: number
          context?: Json | null
          context_version?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          links?: Json
          payload?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_content_snapshots_content_id_team_id_fkey"
            columns: ["content_id", "team_id"]
            isOneToOne: false
            referencedRelation: "crm_contents"
            referencedColumns: ["id", "team_id"]
          },
        ]
      }
      crm_content_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          team_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          team_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_content_tags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          approved_version: number | null
          channel: string | null
          client_at: string | null
          client_status: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          editorial_date: string | null
          format: string
          goal: string
          id: string
          idea: string
          scheduled_time: string | null
          script: string
          status: string
          tag_ids: string[]
          team_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_hash?: string | null
          approved_version?: number | null
          channel?: string | null
          client_at?: string | null
          client_status?: string | null
          content_hash: string
          created_at?: string
          created_by?: string | null
          editorial_date?: string | null
          format?: string
          goal?: string
          id?: string
          idea?: string
          scheduled_time?: string | null
          script?: string
          status?: string
          tag_ids?: string[]
          team_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_hash?: string | null
          approved_version?: number | null
          channel?: string | null
          client_at?: string | null
          client_status?: string | null
          content_hash?: string
          created_at?: string
          created_by?: string | null
          editorial_date?: string | null
          format?: string
          goal?: string
          id?: string
          idea?: string
          scheduled_time?: string | null
          script?: string
          status?: string
          tag_ids?: string[]
          team_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_contents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_flow_runs: {
        Row: {
          client_id: string
          flow_id: string
          id: string
          last_sent_at: string | null
          next_at: string
          opportunity_id: string | null
          started_at: string
          started_by: string | null
          status: string
          step: number
          team_id: string
        }
        Insert: {
          client_id: string
          flow_id: string
          id?: string
          last_sent_at?: string | null
          next_at?: string
          opportunity_id?: string | null
          started_at?: string
          started_by?: string | null
          status?: string
          step?: number
          team_id: string
        }
        Update: {
          client_id?: string
          flow_id?: string
          id?: string
          last_sent_at?: string | null
          next_at?: string
          opportunity_id?: string | null
          started_at?: string
          started_by?: string | null
          status?: string
          step?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_flow_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "crm_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_runs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_flow_runs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_flows: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          steps: Json
          team_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          steps?: Json
          team_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          steps?: Json
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_flows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_form_bookings: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          ends_at: string
          form_id: string
          id: string
          name: string | null
          opportunity_id: string | null
          phone: string | null
          starts_at: string
          status: string
          submission_id: string | null
          team_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          ends_at: string
          form_id: string
          id?: string
          name?: string | null
          opportunity_id?: string | null
          phone?: string | null
          starts_at: string
          status?: string
          submission_id?: string | null
          team_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          ends_at?: string
          form_id?: string
          id?: string
          name?: string | null
          opportunity_id?: string | null
          phone?: string | null
          starts_at?: string
          status?: string
          submission_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_form_bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_bookings_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "crm_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_bookings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_bookings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "crm_form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_bookings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_form_pixel_tokens: {
        Row: {
          access_token: string
          form_id: string
          team_id: string
          test_event_code: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string
          form_id: string
          team_id: string
          test_event_code?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          form_id?: string
          team_id?: string
          test_event_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_form_pixel_tokens_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "crm_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_pixel_tokens_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_form_submissions: {
        Row: {
          answers: Json
          client_id: string | null
          created_at: string
          email: string | null
          form_id: string
          id: string
          name: string | null
          opportunity_id: string | null
          origin: Json | null
          phone: string | null
          qualified: boolean | null
          result: string | null
          score: number | null
          summary: Json
          team_id: string
        }
        Insert: {
          answers: Json
          client_id?: string | null
          created_at?: string
          email?: string | null
          form_id: string
          id?: string
          name?: string | null
          opportunity_id?: string | null
          origin?: Json | null
          phone?: string | null
          qualified?: boolean | null
          result?: string | null
          score?: number | null
          summary?: Json
          team_id: string
        }
        Update: {
          answers?: Json
          client_id?: string | null
          created_at?: string
          email?: string | null
          form_id?: string
          id?: string
          name?: string | null
          opportunity_id?: string | null
          origin?: Json | null
          phone?: string | null
          qualified?: boolean | null
          result?: string | null
          score?: number | null
          summary?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_form_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "crm_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_submissions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_form_visits: {
        Row: {
          active_ms: number
          browser: string | null
          campaign: string | null
          channel: string | null
          city: string | null
          click_id: string | null
          content: string | null
          country: string | null
          created_at: string
          device: string | null
          embed: string | null
          form_id: string
          id: string
          last_at: string
          left_at: string | null
          medium: string | null
          os: string | null
          page: string | null
          qualified: boolean | null
          referrer_host: string | null
          region: string | null
          region_name: string | null
          schedule_view: boolean
          scheduled: boolean
          screen: string
          source: string | null
          started: boolean
          started_at: string
          step_id: string | null
          step_index: number | null
          steps_seen: string[]
          steps_total: number | null
          submission_id: string | null
          submitted: boolean
          team_id: string
          term: string | null
          visitor: string | null
        }
        Insert: {
          active_ms?: number
          browser?: string | null
          campaign?: string | null
          channel?: string | null
          city?: string | null
          click_id?: string | null
          content?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          embed?: string | null
          form_id: string
          id: string
          last_at?: string
          left_at?: string | null
          medium?: string | null
          os?: string | null
          page?: string | null
          qualified?: boolean | null
          referrer_host?: string | null
          region?: string | null
          region_name?: string | null
          schedule_view?: boolean
          scheduled?: boolean
          screen?: string
          source?: string | null
          started?: boolean
          started_at?: string
          step_id?: string | null
          step_index?: number | null
          steps_seen?: string[]
          steps_total?: number | null
          submission_id?: string | null
          submitted?: boolean
          team_id: string
          term?: string | null
          visitor?: string | null
        }
        Update: {
          active_ms?: number
          browser?: string | null
          campaign?: string | null
          channel?: string | null
          city?: string | null
          click_id?: string | null
          content?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          embed?: string | null
          form_id?: string
          id?: string
          last_at?: string
          left_at?: string | null
          medium?: string | null
          os?: string | null
          page?: string | null
          qualified?: boolean | null
          referrer_host?: string | null
          region?: string | null
          region_name?: string | null
          schedule_view?: boolean
          scheduled?: boolean
          screen?: string
          source?: string | null
          started?: boolean
          started_at?: string
          step_id?: string | null
          step_index?: number | null
          steps_seen?: string[]
          steps_total?: number | null
          submission_id?: string | null
          submitted?: boolean
          team_id?: string
          term?: string | null
          visitor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_form_visits_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "crm_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_visits_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "crm_form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_form_visits_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_forms: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          kind: string
          live: Json | null
          live_at: string | null
          name: string
          settings: Json
          slug: string | null
          status: string
          team_id: string
          theme: Json
          updated_at: string
          views: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          id?: string
          kind?: string
          live?: Json | null
          live_at?: string | null
          name: string
          settings?: Json
          slug?: string | null
          status?: string
          team_id: string
          theme?: Json
          updated_at?: string
          views?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          kind?: string
          live?: Json | null
          live_at?: string | null
          name?: string
          settings?: Json
          slug?: string | null
          status?: string
          team_id?: string
          theme?: Json
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_forms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funnel_steps: {
        Row: {
          funnel_id: string
          id: string
          kind: string
          name: string
          position: number
          source: Json
          team_id: string
        }
        Insert: {
          funnel_id: string
          id?: string
          kind: string
          name: string
          position: number
          source?: Json
          team_id: string
        }
        Update: {
          funnel_id?: string
          id?: string
          kind?: string
          name?: string
          position?: number
          source?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_funnel_steps_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "crm_funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_funnel_steps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funnels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          layout: Json
          name: string
          objective: string
          team_id: string
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          layout?: Json
          name: string
          objective?: string
          team_id: string
          template?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          layout?: Json
          name?: string
          objective?: string
          team_id?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_funnels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_accounts: {
        Row: {
          account_type: string | null
          audience: Json
          biography: string | null
          connected_at: string
          connected_by: string | null
          created_at: string
          followers_count: number | null
          follows_count: number | null
          id: string
          ig_user_id: string
          media_count: number | null
          missing: string[]
          name: string | null
          profile_picture_url: string | null
          publish_quota: Json | null
          sync_error: string | null
          synced_at: string | null
          team_id: string
          token_expires_at: string | null
          totals: Json
          updated_at: string
          username: string
          website: string | null
        }
        Insert: {
          account_type?: string | null
          audience?: Json
          biography?: string | null
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          followers_count?: number | null
          follows_count?: number | null
          id?: string
          ig_user_id: string
          media_count?: number | null
          missing?: string[]
          name?: string | null
          profile_picture_url?: string | null
          publish_quota?: Json | null
          sync_error?: string | null
          synced_at?: string | null
          team_id: string
          token_expires_at?: string | null
          totals?: Json
          updated_at?: string
          username?: string
          website?: string | null
        }
        Update: {
          account_type?: string | null
          audience?: Json
          biography?: string | null
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          followers_count?: number | null
          follows_count?: number | null
          id?: string
          ig_user_id?: string
          media_count?: number | null
          missing?: string[]
          name?: string | null
          profile_picture_url?: string | null
          publish_quota?: Json | null
          sync_error?: string | null
          synced_at?: string | null
          team_id?: string
          token_expires_at?: string | null
          totals?: Json
          updated_at?: string
          username?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_accounts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_analyses: {
        Row: {
          account_id: string
          ai: Json | null
          created_at: string
          created_by: string | null
          highlights: Json | null
          id: string
          profile: Json
          report: Json
          score: number
          team_id: string
        }
        Insert: {
          account_id: string
          ai?: Json | null
          created_at?: string
          created_by?: string | null
          highlights?: Json | null
          id?: string
          profile?: Json
          report?: Json
          score: number
          team_id: string
        }
        Update: {
          account_id?: string
          ai?: Json | null
          created_at?: string
          created_by?: string | null
          highlights?: Json | null
          id?: string
          profile?: Json
          report?: Json
          score?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_analyses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_analyses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_comments: {
        Row: {
          account_id: string
          body: string
          comment_id: string
          from_id: string | null
          handled: boolean
          handled_at: string | null
          handled_by: string | null
          hidden: boolean
          like_count: number
          media_id: string
          own: boolean
          parent_id: string | null
          replied: boolean
          team_id: string
          ts: string
          username: string | null
        }
        Insert: {
          account_id: string
          body?: string
          comment_id: string
          from_id?: string | null
          handled?: boolean
          handled_at?: string | null
          handled_by?: string | null
          hidden?: boolean
          like_count?: number
          media_id: string
          own?: boolean
          parent_id?: string | null
          replied?: boolean
          team_id: string
          ts: string
          username?: string | null
        }
        Update: {
          account_id?: string
          body?: string
          comment_id?: string
          from_id?: string | null
          handled?: boolean
          handled_at?: string | null
          handled_by?: string | null
          hidden?: boolean
          like_count?: number
          media_id?: string
          own?: boolean
          parent_id?: string | null
          replied?: boolean
          team_id?: string
          ts?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_comments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_connect_links: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string
          revoked_at: string | null
          team_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          label?: string
          revoked_at?: string | null
          team_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string
          revoked_at?: string | null
          team_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_connect_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_connect_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_daily: {
        Row: {
          account_id: string
          day: string
          followers: number | null
          reach: number | null
          team_id: string
        }
        Insert: {
          account_id: string
          day: string
          followers?: number | null
          reach?: number | null
          team_id: string
        }
        Update: {
          account_id?: string
          day?: string
          followers?: number | null
          reach?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_daily_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_dms: {
        Row: {
          account_id: string
          attachment: string | null
          body: string
          from_me: boolean
          mid: string
          participant_id: string
          sent_by: string | null
          team_id: string
          ts: string
        }
        Insert: {
          account_id: string
          attachment?: string | null
          body?: string
          from_me?: boolean
          mid: string
          participant_id: string
          sent_by?: string | null
          team_id: string
          ts: string
        }
        Update: {
          account_id?: string
          attachment?: string | null
          body?: string
          from_me?: boolean
          mid?: string
          participant_id?: string
          sent_by?: string | null
          team_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_dms_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_dms_account_id_participant_id_fkey"
            columns: ["account_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_threads"
            referencedColumns: ["account_id", "participant_id"]
          },
          {
            foreignKeyName: "crm_instagram_dms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_media: {
        Row: {
          account_id: string
          caption: string | null
          comments_count: number | null
          insights: Json
          like_count: number | null
          media_id: string
          media_type: string
          media_url: string | null
          permalink: string | null
          posted_at: string
          product_type: string | null
          published_by: string | null
          team_id: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          caption?: string | null
          comments_count?: number | null
          insights?: Json
          like_count?: number | null
          media_id: string
          media_type: string
          media_url?: string | null
          permalink?: string | null
          posted_at: string
          product_type?: string | null
          published_by?: string | null
          team_id: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          caption?: string | null
          comments_count?: number | null
          insights?: Json
          like_count?: number | null
          media_id?: string
          media_type?: string
          media_url?: string | null
          permalink?: string | null
          posted_at?: string
          product_type?: string | null
          published_by?: string | null
          team_id?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_media_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_media_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_threads: {
        Row: {
          account_id: string
          last_at: string
          last_from_me: boolean
          last_text: string | null
          name: string | null
          participant_id: string
          team_id: string
          unread: number
          username: string | null
        }
        Insert: {
          account_id: string
          last_at?: string
          last_from_me?: boolean
          last_text?: string | null
          name?: string | null
          participant_id: string
          team_id: string
          unread?: number
          username?: string | null
        }
        Update: {
          account_id?: string
          last_at?: string
          last_from_me?: boolean
          last_text?: string | null
          name?: string | null
          participant_id?: string
          team_id?: string
          unread?: number
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_threads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_threads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_tokens: {
        Row: {
          access_token: string
          account_id: string
          expires_at: string | null
          issued_at: string
          permissions: string[]
        }
        Insert: {
          access_token: string
          account_id: string
          expires_at?: string | null
          issued_at?: string
          permissions?: string[]
        }
        Update: {
          access_token?: string
          account_id?: string
          expires_at?: string | null
          issued_at?: string
          permissions?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_instagram_trials: {
        Row: {
          account_id: string
          caption: string | null
          checkpoints: Json
          container_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          duration_s: number | null
          id: string
          insights: Json
          media_id: string | null
          note: string | null
          permalink: string | null
          published_at: string | null
          read_at: string | null
          status: string
          strategy: string
          team_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          caption?: string | null
          checkpoints?: Json
          container_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          duration_s?: number | null
          id?: string
          insights?: Json
          media_id?: string | null
          note?: string | null
          permalink?: string | null
          published_at?: string | null
          read_at?: string | null
          status?: string
          strategy: string
          team_id: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          caption?: string | null
          checkpoints?: Json
          container_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          duration_s?: number | null
          id?: string
          insights?: Json
          media_id?: string | null
          note?: string | null
          permalink?: string | null
          published_at?: string | null
          read_at?: string | null
          status?: string
          strategy?: string
          team_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_instagram_trials_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_instagram_trials_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_knowledge_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          path: string
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          path: string
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          path?: string
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_knowledge_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_alerts: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string | null
          sent_at: string | null
          team_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id?: string | null
          sent_at?: string | null
          team_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string | null
          sent_at?: string | null
          team_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_alerts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_alerts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_hooks: {
        Row: {
          created_at: string
          enabled: boolean
          rotated_at: string | null
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          rotated_at?: string | null
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          rotated_at?: string | null
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_hooks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_mcp_keys: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          team_id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          team_id: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          team_id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_mcp_keys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_mcp_log: {
        Row: {
          at: string
          error: string | null
          id: number
          key_id: string | null
          ok: boolean
          team_id: string
          tool: string
        }
        Insert: {
          at?: string
          error?: string | null
          id?: never
          key_id?: string | null
          ok: boolean
          team_id: string
          tool: string
        }
        Update: {
          at?: string
          error?: string | null
          id?: never
          key_id?: string | null
          ok?: boolean
          team_id?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_mcp_log_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "crm_mcp_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_mcp_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_mcp_uploads: {
        Row: {
          created_at: string
          expires_at: string
          files: string[]
          folder: string
          id: string
          key_id: string | null
          max_files: number
          team_id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          files?: string[]
          folder?: string
          id?: string
          key_id?: string | null
          max_files?: number
          team_id: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          files?: string[]
          folder?: string
          id?: string
          key_id?: string | null
          max_files?: number
          team_id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_mcp_uploads_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "crm_mcp_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_mcp_uploads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          brief: Json | null
          build: Json | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          history: Json
          id: string
          key: string | null
          next_date: string | null
          next_step: string | null
          notes: string | null
          offer: Json | null
          origin: Json | null
          owner_id: string | null
          pipeline_id: string
          project_id: string | null
          project_name: string | null
          region: string
          search_id: string | null
          stage: string
          team_id: string
          updated_at: string
          video: string | null
        }
        Insert: {
          brief?: Json | null
          build?: Json | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          history?: Json
          id?: string
          key?: string | null
          next_date?: string | null
          next_step?: string | null
          notes?: string | null
          offer?: Json | null
          origin?: Json | null
          owner_id?: string | null
          pipeline_id: string
          project_id?: string | null
          project_name?: string | null
          region?: string
          search_id?: string | null
          stage?: string
          team_id: string
          updated_at?: string
          video?: string | null
        }
        Update: {
          brief?: Json | null
          build?: Json | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          history?: Json
          id?: string
          key?: string | null
          next_date?: string | null
          next_step?: string | null
          notes?: string | null
          offer?: Json | null
          origin?: Json | null
          owner_id?: string | null
          pipeline_id?: string
          project_id?: string | null
          project_name?: string | null
          region?: string
          search_id?: string | null
          stage?: string
          team_id?: string
          updated_at?: string
          video?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "space_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          settings: Json
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          settings?: Json
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          settings?: Json
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_reference_sources: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          every_minutes: number
          id: string
          last_error: string | null
          last_found: number | null
          last_run_at: string | null
          name: string
          run_done: number | null
          run_limit: number | null
          run_note: string | null
          run_requested_at: string | null
          run_stage: string | null
          run_started_at: string | null
          run_total: number | null
          team_id: string
          thread_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          every_minutes?: number
          id?: string
          last_error?: string | null
          last_found?: number | null
          last_run_at?: string | null
          name: string
          run_done?: number | null
          run_limit?: number | null
          run_note?: string | null
          run_requested_at?: string | null
          run_stage?: string | null
          run_started_at?: string | null
          run_total?: number | null
          team_id: string
          thread_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          every_minutes?: number
          id?: string
          last_error?: string | null
          last_found?: number | null
          last_run_at?: string | null
          name?: string
          run_done?: number | null
          run_limit?: number | null
          run_note?: string | null
          run_requested_at?: string | null
          run_stage?: string | null
          run_started_at?: string | null
          run_total?: number | null
          team_id?: string
          thread_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_reference_sources_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_references: {
        Row: {
          author: string | null
          auto: boolean
          caption: string | null
          comments: number | null
          created_at: string
          created_by: string | null
          frames: string[]
          group_order: number | null
          id: string
          kind: string
          likes: number | null
          media_path: string | null
          metrics_at: string | null
          notes: string
          platform: string
          reviewed: boolean
          source_id: string | null
          starred: boolean
          tags: string[]
          team_id: string
          title: string
          updated_at: string
          url: string
          views: number | null
        }
        Insert: {
          author?: string | null
          auto?: boolean
          caption?: string | null
          comments?: number | null
          created_at?: string
          created_by?: string | null
          frames?: string[]
          group_order?: number | null
          id?: string
          kind?: string
          likes?: number | null
          media_path?: string | null
          metrics_at?: string | null
          notes?: string
          platform?: string
          reviewed?: boolean
          source_id?: string | null
          starred?: boolean
          tags?: string[]
          team_id: string
          title?: string
          updated_at?: string
          url: string
          views?: number | null
        }
        Update: {
          author?: string | null
          auto?: boolean
          caption?: string | null
          comments?: number | null
          created_at?: string
          created_by?: string | null
          frames?: string[]
          group_order?: number | null
          id?: string
          kind?: string
          likes?: number | null
          media_path?: string | null
          metrics_at?: string | null
          notes?: string
          platform?: string
          reviewed?: boolean
          source_id?: string | null
          starred?: boolean
          tags?: string[]
          team_id?: string
          title?: string
          updated_at?: string
          url?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_references_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "crm_reference_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_references_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stories: {
        Row: {
          account_id: string | null
          approved_at: string | null
          approved_by: string | null
          attempts: number
          caption: string
          created_at: string
          created_by: string | null
          error: string | null
          frames: Json
          id: string
          idea: Json
          insights_at: string | null
          kind: string
          next_try_at: string | null
          pillar: string
          plan: Json | null
          post_id: string | null
          publish_at: string
          published_at: string | null
          review: Json | null
          set_id: string | null
          set_project_id: string | null
          share_to_feed: boolean
          status: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          caption?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          frames?: Json
          id?: string
          idea?: Json
          insights_at?: string | null
          kind?: string
          next_try_at?: string | null
          pillar?: string
          plan?: Json | null
          post_id?: string | null
          publish_at: string
          published_at?: string | null
          review?: Json | null
          set_id?: string | null
          set_project_id?: string | null
          share_to_feed?: boolean
          status?: string
          team_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          caption?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          frames?: Json
          id?: string
          idea?: Json
          insights_at?: string | null
          kind?: string
          next_try_at?: string | null
          pillar?: string
          plan?: Json | null
          post_id?: string | null
          publish_at?: string
          published_at?: string | null
          review?: Json | null
          set_id?: string | null
          set_project_id?: string | null
          share_to_feed?: boolean
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_stories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_story_settings: {
        Row: {
          account_id: string | null
          brief: string
          days: number[]
          frames_max: number
          photos: boolean
          pillars: Json
          set_id: string | null
          set_project_id: string | null
          team_id: string
          times: string[]
          updated_at: string
          updated_by: string | null
          web: boolean
        }
        Insert: {
          account_id?: string | null
          brief?: string
          days?: number[]
          frames_max?: number
          photos?: boolean
          pillars?: Json
          set_id?: string | null
          set_project_id?: string | null
          team_id: string
          times?: string[]
          updated_at?: string
          updated_by?: string | null
          web?: boolean
        }
        Update: {
          account_id?: string | null
          brief?: string
          days?: number[]
          frames_max?: number
          photos?: boolean
          pillars?: Json
          set_id?: string | null
          set_project_id?: string | null
          team_id?: string
          times?: string[]
          updated_at?: string
          updated_by?: string | null
          web?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_story_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_story_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          label: string
          role: string
          team_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string
          role?: string
          team_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_team_members: {
        Row: {
          created_at: string
          invited_by: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_teams: {
        Row: {
          archived_at: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          created_by: string | null
          id: string
          is_home: boolean
          modules: Json
          name: string
          notes: string
          product: string
          segment: string
          status: string
          updated_at: string
          website: string
        }
        Insert: {
          archived_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_home?: boolean
          modules?: Json
          name: string
          notes?: string
          product?: string
          segment?: string
          status?: string
          updated_at?: string
          website?: string
        }
        Update: {
          archived_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_home?: boolean
          modules?: Json
          name?: string
          notes?: string
          product?: string
          segment?: string
          status?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      crm_whatsapp_auth: {
        Row: {
          key: string
          team_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          team_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          team_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_auth_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_chats: {
        Row: {
          jid: string
          last_at: string
          last_from_me: boolean
          last_text: string | null
          name: string | null
          phone: string | null
          photo_checked_at: string | null
          photo_path: string | null
          tags: string[]
          team_id: string
          unread: number
        }
        Insert: {
          jid: string
          last_at?: string
          last_from_me?: boolean
          last_text?: string | null
          name?: string | null
          phone?: string | null
          photo_checked_at?: string | null
          photo_path?: string | null
          tags?: string[]
          team_id: string
          unread?: number
        }
        Update: {
          jid?: string
          last_at?: string
          last_from_me?: boolean
          last_text?: string | null
          name?: string | null
          phone?: string | null
          photo_checked_at?: string | null
          photo_path?: string | null
          tags?: string[]
          team_id?: string
          unread?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_chats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_client_contacts: {
        Row: {
          account_id: string
          created_at: string
          enabled: boolean
          leads: boolean
          name: string
          phone: string
          report_hour: number
          report_kind: string
          report_last_on: string | null
          report_monthday: number
          report_weekday: number
          reports: boolean
          team_id: string
          topics: string[]
        }
        Insert: {
          account_id: string
          created_at?: string
          enabled?: boolean
          leads?: boolean
          name?: string
          phone: string
          report_hour?: number
          report_kind?: string
          report_last_on?: string | null
          report_monthday?: number
          report_weekday?: number
          reports?: boolean
          team_id: string
          topics?: string[]
        }
        Update: {
          account_id?: string
          created_at?: string
          enabled?: boolean
          leads?: boolean
          name?: string
          phone?: string
          report_hour?: number
          report_kind?: string
          report_last_on?: string | null
          report_monthday?: number
          report_weekday?: number
          reports?: boolean
          team_id?: string
          topics?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_client_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_whatsapp_client_contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_client_log: {
        Row: {
          account_id: string
          answered: boolean
          created_at: string
          id: string
          phone: string
          question: string
          team_id: string
          topic: string | null
        }
        Insert: {
          account_id: string
          answered?: boolean
          created_at?: string
          id?: string
          phone: string
          question: string
          team_id: string
          topic?: string | null
        }
        Update: {
          account_id?: string
          answered?: boolean
          created_at?: string
          id?: string
          phone?: string
          question?: string
          team_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_client_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_whatsapp_client_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_commanders: {
        Row: {
          created_at: string
          created_by: string | null
          name: string
          phone: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          name?: string
          phone: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          name?: string
          phone?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_commanders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_groups: {
        Row: {
          jid: string
          leads_account_id: string | null
          name: string
          seen_at: string
          size: number
          team_id: string
        }
        Insert: {
          jid: string
          leads_account_id?: string | null
          name?: string
          seen_at?: string
          size?: number
          team_id: string
        }
        Update: {
          jid?: string
          leads_account_id?: string | null
          name?: string
          seen_at?: string
          size?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_groups_leads_account_id_fkey"
            columns: ["leads_account_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_whatsapp_groups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_messages: {
        Row: {
          body: string
          chat_jid: string
          error: string | null
          from_me: boolean
          id: string
          kind: string
          media_mime: string | null
          media_name: string | null
          media_path: string | null
          sent_by: string | null
          status: string
          team_id: string
          ts: string
          wa_id: string | null
        }
        Insert: {
          body?: string
          chat_jid: string
          error?: string | null
          from_me?: boolean
          id?: string
          kind?: string
          media_mime?: string | null
          media_name?: string | null
          media_path?: string | null
          sent_by?: string | null
          status?: string
          team_id: string
          ts?: string
          wa_id?: string | null
        }
        Update: {
          body?: string
          chat_jid?: string
          error?: string | null
          from_me?: boolean
          id?: string
          kind?: string
          media_mime?: string | null
          media_name?: string | null
          media_path?: string | null
          sent_by?: string | null
          status?: string
          team_id?: string
          ts?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_messages_team_id_chat_jid_fkey"
            columns: ["team_id", "chat_jid"]
            isOneToOne: false
            referencedRelation: "crm_whatsapp_chats"
            referencedColumns: ["team_id", "jid"]
          },
          {
            foreignKeyName: "crm_whatsapp_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_numbers: {
        Row: {
          connected_at: string | null
          error: string | null
          phone: string | null
          profile_name: string | null
          qr: string | null
          requested_at: string | null
          requested_by: string | null
          seen_at: string | null
          status: string
          team_id: string
          updated_at: string
          wanted: boolean
        }
        Insert: {
          connected_at?: string | null
          error?: string | null
          phone?: string | null
          profile_name?: string | null
          qr?: string | null
          requested_at?: string | null
          requested_by?: string | null
          seen_at?: string | null
          status?: string
          team_id: string
          updated_at?: string
          wanted?: boolean
        }
        Update: {
          connected_at?: string | null
          error?: string | null
          phone?: string | null
          profile_name?: string | null
          qr?: string | null
          requested_at?: string | null
          requested_by?: string | null
          seen_at?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          wanted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_numbers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_reports: {
        Row: {
          enabled: boolean
          hour: number
          kind: string
          last_sent_on: string | null
          team_id: string
          weekday: number
        }
        Insert: {
          enabled?: boolean
          hour?: number
          kind: string
          last_sent_on?: string | null
          team_id: string
          weekday?: number
        }
        Update: {
          enabled?: boolean
          hour?: number
          kind?: string
          last_sent_on?: string | null
          team_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
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
      lead_interactions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_projects: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "lead_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number | null
          id: string
          kanban_status: Database["public"]["Enums"]["lead_status"]
          name: string
          notes: string | null
          phone: string | null
          position: number
          source: Database["public"]["Enums"]["lead_source"]
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          kanban_status?: Database["public"]["Enums"]["lead_status"]
          name: string
          notes?: string | null
          phone?: string | null
          position?: number
          source?: Database["public"]["Enums"]["lead_source"]
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          kanban_status?: Database["public"]["Enums"]["lead_status"]
          name?: string
          notes?: string | null
          phone?: string | null
          position?: number
          source?: Database["public"]["Enums"]["lead_source"]
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      product_suggestions: {
        Row: {
          area: string
          created_at: string
          description: string
          id: string
          impact: string
          kind: string
          original: string
          priority: string | null
          product_note: string
          screen_path: string
          screen_title: string
          status: string
          team_id: string | null
          team_name: string
          title: string
          updated_at: string
          user_id: string | null
          user_name: string
          via: string
        }
        Insert: {
          area?: string
          created_at?: string
          description?: string
          id?: string
          impact?: string
          kind?: string
          original?: string
          priority?: string | null
          product_note?: string
          screen_path?: string
          screen_title?: string
          status?: string
          team_id?: string | null
          team_name?: string
          title: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
          via?: string
        }
        Update: {
          area?: string
          created_at?: string
          description?: string
          id?: string
          impact?: string
          kind?: string
          original?: string
          priority?: string | null
          product_note?: string
          screen_path?: string
          screen_title?: string
          status?: string
          team_id?: string | null
          team_name?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suggestions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          avatar_path: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_demo: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          avatar_path?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_demo?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_demo?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          actual_hours: number
          assignee_id: string | null
          billed_at: string | null
          billing_status: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          hourly_rate: number | null
          id: string
          kanban_status: Database["public"]["Enums"]["task_status"]
          position: number
          project_id: string
          service_catalog_id: string | null
          task_cost: number | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_hours?: number
          assignee_id?: string | null
          billed_at?: string | null
          billing_status?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          hourly_rate?: number | null
          id?: string
          kanban_status?: Database["public"]["Enums"]["task_status"]
          position?: number
          project_id: string
          service_catalog_id?: string | null
          task_cost?: number | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_hours?: number
          assignee_id?: string | null
          billed_at?: string | null
          billing_status?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          hourly_rate?: number | null
          id?: string
          kanban_status?: Database["public"]["Enums"]["task_status"]
          position?: number
          project_id?: string
          service_catalog_id?: string | null
          task_cost?: number | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_account_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget?: number | null
          client_account_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget?: number | null
          client_account_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      service_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          default_hourly_rate: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_hourly_rate?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_hourly_rate?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_events: {
        Row: {
          active_ms: number | null
          at: string
          data: Json
          id: number
          name: string | null
          path: string | null
          pv: string | null
          scroll: number | null
          session_id: string
          site_id: string
          team_id: string
          title: string | null
          type: string
          visitor_id: string
        }
        Insert: {
          active_ms?: number | null
          at?: string
          data?: Json
          id?: never
          name?: string | null
          path?: string | null
          pv?: string | null
          scroll?: number | null
          session_id: string
          site_id: string
          team_id: string
          title?: string | null
          type: string
          visitor_id: string
        }
        Update: {
          active_ms?: number | null
          at?: string
          data?: Json
          id?: never
          name?: string | null
          path?: string | null
          pv?: string | null
          scroll?: number | null
          session_id?: string
          site_id?: string
          team_id?: string
          title?: string | null
          type?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "site_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site_trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      site_sessions: {
        Row: {
          active_ms: number
          browser: string | null
          campaign: string | null
          channel: string
          city: string | null
          click_id: string | null
          content: string | null
          conversions: string[]
          converted: boolean
          country: string | null
          currency: string | null
          details: Json
          device: string | null
          events: number
          exit_path: string | null
          geo_radius: number | null
          id: string
          landing_path: string | null
          lang: string | null
          last_at: string
          lat: number | null
          lon: number | null
          medium: string | null
          network: string | null
          orders: number
          os: string | null
          pageviews: number
          referrer: string | null
          referrer_host: string | null
          region: string | null
          region_name: string | null
          revenue: number
          screen: string | null
          site_id: string
          source: string | null
          started_at: string
          team_id: string
          term: string | null
          tz: string | null
          visit_number: number
          visitor_id: string
        }
        Insert: {
          active_ms?: number
          browser?: string | null
          campaign?: string | null
          channel?: string
          city?: string | null
          click_id?: string | null
          content?: string | null
          conversions?: string[]
          converted?: boolean
          country?: string | null
          currency?: string | null
          details?: Json
          device?: string | null
          events?: number
          exit_path?: string | null
          geo_radius?: number | null
          id: string
          landing_path?: string | null
          lang?: string | null
          last_at?: string
          lat?: number | null
          lon?: number | null
          medium?: string | null
          network?: string | null
          orders?: number
          os?: string | null
          pageviews?: number
          referrer?: string | null
          referrer_host?: string | null
          region?: string | null
          region_name?: string | null
          revenue?: number
          screen?: string | null
          site_id: string
          source?: string | null
          started_at?: string
          team_id: string
          term?: string | null
          tz?: string | null
          visit_number?: number
          visitor_id: string
        }
        Update: {
          active_ms?: number
          browser?: string | null
          campaign?: string | null
          channel?: string
          city?: string | null
          click_id?: string | null
          content?: string | null
          conversions?: string[]
          converted?: boolean
          country?: string | null
          currency?: string | null
          details?: Json
          device?: string | null
          events?: number
          exit_path?: string | null
          geo_radius?: number | null
          id?: string
          landing_path?: string | null
          lang?: string | null
          last_at?: string
          lat?: number | null
          lon?: number | null
          medium?: string | null
          network?: string | null
          orders?: number
          os?: string | null
          pageviews?: number
          referrer?: string | null
          referrer_host?: string | null
          region?: string | null
          region_name?: string | null
          revenue?: number
          screen?: string | null
          site_id?: string
          source?: string | null
          started_at?: string
          team_id?: string
          term?: string | null
          tz?: string | null
          visit_number?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_sessions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "site_trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      site_trackers: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          last_seen_at: string | null
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          last_seen_at?: string | null
          name?: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_trackers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      space_page_share_responses: {
        Row: {
          created_at: string
          decision: string
          id: string
          name: string
          note: string
          share_id: string
          version: number
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          name?: string
          note?: string
          share_id: string
          version: number
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          name?: string
          note?: string
          share_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "space_page_share_responses_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "space_page_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      space_page_shares: {
        Row: {
          created_at: string
          html_hash: string
          html_path: string
          id: string
          owner_id: string
          page_id: string
          page_name: string
          project_id: string
          project_name: string
          shared_at: string
          version: number
        }
        Insert: {
          created_at?: string
          html_hash: string
          html_path: string
          id?: string
          owner_id?: string
          page_id: string
          page_name: string
          project_id: string
          project_name: string
          shared_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          html_hash?: string
          html_path?: string
          id?: string
          owner_id?: string
          page_id?: string
          page_name?: string
          project_id?: string
          project_name?: string
          shared_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "space_page_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "space_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      space_project_events: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          owner_id: string | null
          project_id: string
          project_name: string
          target: string
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          owner_id?: string | null
          project_id: string
          project_name?: string
          target?: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          owner_id?: string | null
          project_id?: string
          project_name?: string
          target?: string
        }
        Relationships: []
      }
      space_project_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          label: string
          project_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string
          project_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "space_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      space_project_members: {
        Row: {
          created_at: string
          invited_by: string | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "space_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      space_project_versions: {
        Row: {
          doc_path: string
          id: string
          project_id: string
          reason: string
          revision: number
          saved_at: string
          saved_by: string | null
          saved_by_email: string
          summary: Json
        }
        Insert: {
          doc_path: string
          id?: string
          project_id: string
          reason?: string
          revision: number
          saved_at?: string
          saved_by?: string | null
          saved_by_email?: string
          summary?: Json
        }
        Update: {
          doc_path?: string
          id?: string
          project_id?: string
          reason?: string
          revision?: number
          saved_at?: string
          saved_by?: string | null
          saved_by_email?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "space_project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "space_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      space_projects: {
        Row: {
          archived_at: string | null
          context: string
          created_at: string
          doc_path: string | null
          id: string
          name: string
          owner_id: string
          revision: number
          summary: Json
          team_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          context?: string
          created_at?: string
          doc_path?: string | null
          id: string
          name: string
          owner_id?: string
          revision?: number
          summary?: Json
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          context?: string
          created_at?: string
          doc_path?: string | null
          id?: string
          name?: string
          owner_id?: string
          revision?: number
          summary?: Json
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "crm_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      space_skills: {
        Row: {
          created_at: string
          hint: string
          id: string
          instructions: string
          name: string
          needs_image: boolean
          owner_id: string
          scope: string
          starters: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          hint?: string
          id?: string
          instructions: string
          name: string
          needs_image?: boolean
          owner_id?: string
          scope?: string
          starters?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          hint?: string
          id?: string
          instructions?: string
          name?: string
          needs_image?: boolean
          owner_id?: string
          scope?: string
          starters?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      space_wordpress_connections: {
        Row: {
          connection: Json
          owner_id: string
          password: string
          project_id: string
          updated_at: string
        }
        Insert: {
          connection: Json
          owner_id?: string
          password: string
          project_id: string
          updated_at?: string
        }
        Update: {
          connection?: Json
          owner_id?: string
          password?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_wordpress_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "space_projects"
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
      project_cost_summary: {
        Row: {
          billed_cost: number | null
          budget: number | null
          client_account_id: string | null
          completed_tasks: number | null
          deadline: string | null
          project_id: string | null
          project_name: string | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          total_actual_hours: number | null
          total_cost: number | null
          total_estimated_hours: number | null
          total_tasks: number | null
          unbilled_cost: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "shared_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      accept_crm_invite: { Args: { p_id: string }; Returns: string }
      accept_space_invite: { Args: { p_id: string }; Returns: string }
      can_join_crm_board_topic: { Args: { p_topic: string }; Returns: boolean }
      can_join_crm_mcp_topic: { Args: { p_topic: string }; Returns: boolean }
      can_join_space_project_topic: {
        Args: { p_topic: string }
        Returns: boolean
      }
      can_read_crm_whatsapp_file: { Args: { p_name: string }; Returns: boolean }
      can_use_crm_file: { Args: { p_name: string }; Returns: boolean }
      can_use_page_share_file: { Args: { p_name: string }; Returns: boolean }
      can_use_space_project_file: { Args: { p_name: string }; Returns: boolean }
      can_write_crm_form_file: { Args: { p_name: string }; Returns: boolean }
      can_write_crm_whatsapp_out: { Args: { p_name: string }; Returns: boolean }
      create_crm_account: {
        Args: {
          p_contact_email?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_modules?: Json
          p_name: string
          p_segment?: string
          p_website?: string
        }
        Returns: string
      }
      create_crm_team: { Args: { p_name: string }; Returns: string }
      crm_accounts_overview: {
        Args: never
        Returns: {
          archived_at: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          i_am_member: boolean
          id: string
          is_home: boolean
          members: number
          modules: Json
          name: string
          notes: string
          product: string
          segment: string
          status: string
          website: string
        }[]
      }
      crm_approval_comment: {
        Args: {
          p_body: string
          p_item: string
          p_link: string
          p_name: string
          p_post: number
          p_slide: number
        }
        Returns: Json
      }
      crm_approval_create: {
        Args: {
          p_items: Json
          p_link: string
          p_message: string
          p_team: string
          p_title: string
        }
        Returns: string
      }
      crm_approval_file_ok: { Args: { p_name: string }; Returns: boolean }
      crm_approval_get: { Args: { p_link: string }; Returns: Json }
      crm_approval_guard: {
        Args: { p_link: string }
        Returns: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          ig_username: string | null
          message: string
          revoked_at: string | null
          team_id: string
          team_name: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_approval_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_approval_on: { Args: { p_team: string }; Returns: boolean }
      crm_approval_respond: {
        Args: {
          p_decision: string
          p_item: string
          p_link: string
          p_name: string
          p_note: string
        }
        Returns: Json
      }
      crm_approval_revoke: { Args: { p_link: string }; Returns: undefined }
      crm_archive_account: { Args: { p_team: string }; Returns: undefined }
      crm_board_take_pending: { Args: { p_board: string }; Returns: Json }
      crm_brand_save: {
        Args: { p_md: string; p_team: string }
        Returns: undefined
      }
      crm_claim_lead_alert: { Args: { p_id: string }; Returns: boolean }
      crm_claim_stories: {
        Args: { p_max?: number }
        Returns: {
          account_id: string | null
          approved_at: string | null
          approved_by: string | null
          attempts: number
          caption: string
          created_at: string
          created_by: string | null
          error: string | null
          frames: Json
          id: string
          idea: Json
          insights_at: string | null
          kind: string
          next_try_at: string | null
          pillar: string
          plan: Json | null
          post_id: string | null
          publish_at: string
          published_at: string | null
          review: Json | null
          set_id: string | null
          set_project_id: string | null
          share_to_feed: boolean
          status: string
          team_id: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_stories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crm_content_comment: {
        Args: {
          p_body: string
          p_content: string
          p_internal: boolean
          p_post: number
          p_slide: number
        }
        Returns: {
          author_id: string | null
          author_name: string
          body: string
          content_id: string | null
          created_at: string
          from_client: boolean
          id: string
          internal: boolean
          item_id: string | null
          post: number | null
          resolved_at: string | null
          resolved_by: string | null
          slide: number | null
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_content_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_comment_delete: {
        Args: { p_comment: string }
        Returns: undefined
      }
      crm_content_comment_resolve: {
        Args: { p_comment: string; p_resolved: boolean }
        Returns: undefined
      }
      crm_content_create: {
        Args: { p_data: Json; p_team: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          approved_version: number | null
          channel: string | null
          client_at: string | null
          client_status: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          editorial_date: string | null
          format: string
          goal: string
          id: string
          idea: string
          scheduled_time: string | null
          script: string
          status: string
          tag_ids: string[]
          team_id: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_delete: { Args: { p_id: string }; Returns: undefined }
      crm_content_hash: {
        Args: {
          p_format: string
          p_goal: string
          p_idea: string
          p_script: string
          p_title: string
        }
        Returns: string
      }
      crm_content_link: {
        Args: {
          p_artifact: string
          p_content: string
          p_hash: string
          p_kind: string
          p_project: string
        }
        Returns: {
          artifact_id: string
          content_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          linked_hash: string
          project_id: string | null
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_content_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_save: {
        Args: { p_data: Json; p_expected: number; p_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          approved_version: number | null
          channel: string | null
          client_at: string | null
          client_status: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          editorial_date: string | null
          format: string
          goal: string
          id: string
          idea: string
          scheduled_time: string | null
          script: string
          status: string
          tag_ids: string[]
          team_id: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_schedule: {
        Args: {
          p_channel: string
          p_date: string
          p_expected: number
          p_id: string
          p_time: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          approved_version: number | null
          channel: string | null
          client_at: string | null
          client_status: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          editorial_date: string | null
          format: string
          goal: string
          id: string
          idea: string
          scheduled_time: string | null
          script: string
          status: string
          tag_ids: string[]
          team_id: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_set_tags: {
        Args: { p_id: string; p_tags: string[] }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          approved_version: number | null
          channel: string | null
          client_at: string | null
          client_status: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          editorial_date: string | null
          format: string
          goal: string
          id: string
          idea: string
          scheduled_time: string | null
          script: string
          status: string
          tag_ids: string[]
          team_id: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_tag_delete: { Args: { p_id: string }; Returns: undefined }
      crm_content_tag_save: {
        Args: { p_color: string; p_id: string; p_name: string; p_team: string }
        Returns: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_content_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_transition: {
        Args: { p_expected: number; p_id: string; p_to: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          approved_hash: string | null
          approved_version: number | null
          channel: string | null
          client_at: string | null
          client_status: string | null
          content_hash: string
          created_at: string
          created_by: string | null
          editorial_date: string | null
          format: string
          goal: string
          id: string
          idea: string
          scheduled_time: string | null
          script: string
          status: string
          tag_ids: string[]
          team_id: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_contents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_content_unlink: {
        Args: { p_content: string; p_kind: string }
        Returns: undefined
      }
      crm_context_save: {
        Args: { p_data: Json; p_expected: number; p_team: string }
        Returns: {
          audience: string
          brand_md: string
          goal: string
          offer: string
          pillars: Json
          restrictions: string
          team_id: string
          tone: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "crm_account_context"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_creative_approval_create: {
        Args: {
          p_ig: string
          p_items: Json
          p_link: string
          p_message: string
          p_team: string
          p_title: string
        }
        Returns: string
      }
      crm_creative_item_comment: {
        Args: { p_body: string; p_internal: boolean; p_item: string }
        Returns: {
          author_id: string | null
          author_name: string
          body: string
          content_id: string | null
          created_at: string
          from_client: boolean
          id: string
          internal: boolean
          item_id: string | null
          post: number | null
          resolved_at: string | null
          resolved_by: string | null
          slide: number | null
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_content_comments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crm_creative_require: { Args: { p_team: string }; Returns: string }
      crm_form_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          team_id: string
        }[]
      }
      crm_form_track: {
        Args: { p_first?: Json; p_form: string; p_hit: Json; p_visit: string }
        Returns: boolean
      }
      crm_form_view: { Args: { p_form: string }; Returns: undefined }
      crm_instagram_receive_dm: {
        Args: {
          p_attachment: string
          p_body: string
          p_from_me: boolean
          p_instagram: string
          p_mid: string
          p_participant: string
          p_ts: string
        }
        Returns: number
      }
      crm_is_platform_admin: { Args: never; Returns: boolean }
      crm_known_modules: { Args: never; Returns: string[] }
      crm_lead_hook: {
        Args: { p_rotate?: boolean; p_team: string }
        Returns: {
          enabled: boolean
          token: string
        }[]
      }
      crm_mcp_call: {
        Args: { p_args: Json; p_fn: string; p_user: string }
        Returns: Json
      }
      crm_mcp_key_create: {
        Args: { p_name: string; p_team: string }
        Returns: {
          id: string
          prefix: string
          token: string
        }[]
      }
      crm_mcp_key_revoke: { Args: { p_id: string }; Returns: undefined }
      crm_mcp_resolve: {
        Args: { p_hash: string }
        Returns: {
          key_id: string
          role: string
          team_id: string
          user_id: string
        }[]
      }
      crm_module_on: {
        Args: { p_module: string; p_team: string }
        Returns: boolean
      }
      crm_person_name: { Args: { p_user: string }; Returns: string }
      crm_purge_account: { Args: { p_team: string }; Returns: undefined }
      crm_receive_lead: {
        Args: { p_alert: string; p_lead: Json; p_origin: Json; p_team: string }
        Returns: Json
      }
      crm_restore_account: { Args: { p_team: string }; Returns: undefined }
      crm_save_funnel: {
        Args: {
          p_id: string
          p_name: string
          p_objective: string
          p_steps: Json
          p_team: string
          p_template: string
        }
        Returns: string
      }
      crm_set_account_status: {
        Args: { p_status: string; p_team: string }
        Returns: undefined
      }
      crm_set_modules: {
        Args: { p_modules: Json; p_team: string }
        Returns: Json
      }
      crm_set_product: {
        Args: { p_product: string; p_team: string }
        Returns: string
      }
      crm_social_sync_tick: { Args: never; Returns: Json }
      crm_stories_tick: { Args: never; Returns: undefined }
      crm_support_access: { Args: { p_team: string }; Returns: undefined }
      crm_team_people: {
        Args: { p_team: string }
        Returns: {
          avatar_path: string
          email: string
          full_name: string
          joined_at: string
          role: string
          user_id: string
        }[]
      }
      crm_team_role: { Args: { p_team: string }; Returns: string }
      crm_v2_require: {
        Args: { p_manager: boolean; p_team: string }
        Returns: string
      }
      crm_v2_text: {
        Args: {
          p_data: Json
          p_key: string
          p_max: number
          p_required?: boolean
        }
        Returns: string
      }
      crm_whatsapp_claim_contact_report: {
        Args: { p_phone: string; p_team: string; p_today: string }
        Returns: boolean
      }
      crm_whatsapp_claim_report: {
        Args: { p_kind: string; p_team: string; p_today: string }
        Returns: boolean
      }
      crm_whatsapp_connect: { Args: { p_team: string }; Returns: undefined }
      crm_whatsapp_disconnect: { Args: { p_team: string }; Returns: undefined }
      crm_whatsapp_enqueue_reply: {
        Args: { p_jid: string; p_team: string; p_text: string }
        Returns: string
      }
      crm_whatsapp_new_chat: {
        Args: { p_phone: string; p_team: string; p_text: string }
        Returns: string
      }
      crm_whatsapp_read: {
        Args: { p_jid: string; p_team: string }
        Returns: undefined
      }
      crm_whatsapp_send: {
        Args: { p_jid: string; p_team: string; p_text: string }
        Returns: string
      }
      crm_whatsapp_send_media: {
        Args: {
          p_caption: string
          p_jid: string
          p_kind: string
          p_mime: string
          p_name: string
          p_path: string
          p_team: string
        }
        Returns: string
      }
      crm_whatsapp_set_tags: {
        Args: { p_jid: string; p_tags: string[]; p_team: string }
        Returns: undefined
      }
      crm_whatsapp_store: {
        Args: {
          p_body: string
          p_from_me: boolean
          p_jid: string
          p_kind: string
          p_name: string
          p_team: string
          p_ts: string
          p_wa_id: string
        }
        Returns: undefined
      }
      get_crm_invite: { Args: { p_id: string }; Returns: Json }
      get_page_share: { Args: { p_id: string }; Returns: Json }
      get_space_invite: { Args: { p_id: string }; Returns: Json }
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
      is_crm_manager: { Args: { p_team: string }; Returns: boolean }
      is_crm_member: { Args: { p_team: string }; Returns: boolean }
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
      product_suggestion_create: {
        Args: { p_data: Json }
        Returns: {
          area: string
          created_at: string
          description: string
          id: string
          impact: string
          kind: string
          original: string
          priority: string | null
          product_note: string
          screen_path: string
          screen_title: string
          status: string
          team_id: string | null
          team_name: string
          title: string
          updated_at: string
          user_id: string | null
          user_name: string
          via: string
        }
        SetofOptions: {
          from: "*"
          to: "product_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_suggestion_update: {
        Args: {
          p_id: string
          p_note: string
          p_priority: string
          p_status: string
        }
        Returns: {
          area: string
          created_at: string
          description: string
          id: string
          impact: string
          kind: string
          original: string
          priority: string | null
          product_note: string
          screen_path: string
          screen_title: string
          status: string
          team_id: string | null
          team_name: string
          title: string
          updated_at: string
          user_id: string | null
          user_name: string
          via: string
        }
        SetofOptions: {
          from: "*"
          to: "product_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      profile_sync_email: { Args: never; Returns: string }
      public_set_proposal_status_by_token: {
        Args: { p_status: string; p_token: string }
        Returns: boolean
      }
      respond_page_share: {
        Args: {
          p_decision: string
          p_id: string
          p_name: string
          p_note: string
          p_version: number
        }
        Returns: string
      }
      site_collect: {
        Args: { p_hits: Json; p_host: string; p_session: Json; p_site: string }
        Returns: number
      }
      site_collect_core: {
        Args: { p_hits: Json; p_host: string; p_session: Json; p_site: string }
        Returns: number
      }
      site_report: {
        Args: { p_from: string; p_site: string; p_to: string; p_tz?: string }
        Returns: Json
      }
      space_log: {
        Args: {
          p_action: string
          p_details: Json
          p_name?: string
          p_owner?: string
          p_project: string
          p_target: string
        }
        Returns: string
      }
      space_log_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_project: string
          p_target?: string
        }
        Returns: string
      }
      space_project_people: {
        Args: { p_project: string }
        Returns: {
          email: string
          joined_at: string
          role: string
          user_id: string
        }[]
      }
      space_project_role: { Args: { p_project: string }; Returns: string }
    }
    Enums: {
      app_role: "free" | "pro" | "admin"
      lead_source:
        | "indication"
        | "instagram"
        | "linkedin"
        | "website"
        | "cold_outreach"
        | "other"
      lead_status:
        | "new_lead"
        | "contacted"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      task_status:
        | "backlog"
        | "todo"
        | "in_progress"
        | "in_review"
        | "done"
        | "billed"
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
      app_role: ["free", "pro", "admin"],
      lead_source: [
        "indication",
        "instagram",
        "linkedin",
        "website",
        "cold_outreach",
        "other",
      ],
      lead_status: [
        "new_lead",
        "contacted",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      task_status: [
        "backlog",
        "todo",
        "in_progress",
        "in_review",
        "done",
        "billed",
      ],
      workspace_role: ["owner", "member", "manager"],
    },
  },
} as const
