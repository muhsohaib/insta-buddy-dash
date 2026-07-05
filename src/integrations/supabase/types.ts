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
      account_details: {
        Row: {
          account_id: string
          app_name: string
          bio: string
          competitors: string[]
          created_at: string
          id: string
          ig_username: string | null
          niche: string
          notes: string | null
          org_id: string
          profile_photo_url: string | null
          target_country: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          account_id: string
          app_name: string
          bio: string
          competitors?: string[]
          created_at?: string
          id?: string
          ig_username?: string | null
          niche: string
          notes?: string | null
          org_id: string
          profile_photo_url?: string | null
          target_country: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          account_id?: string
          app_name?: string
          bio?: string
          competitors?: string[]
          created_at?: string
          id?: string
          ig_username?: string | null
          niche?: string
          notes?: string | null
          org_id?: string
          profile_photo_url?: string | null
          target_country?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_details_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          id: string
          occurred_at: string
          org_id: string
          payload: Json
          resource_id: string | null
          resource_type: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          id?: string
          occurred_at?: string
          org_id: string
          payload?: Json
          resource_id?: string | null
          resource_type: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          id?: string
          occurred_at?: string
          org_id?: string
          payload?: Json
          resource_id?: string | null
          resource_type?: string
          summary?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by_user_id: string
          expires_at: string | null
          id: string
          label: string
          last_used_at: string | null
          org_id: string
          prefix: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          expires_at?: string | null
          id?: string
          label: string
          last_used_at?: string | null
          org_id: string
          prefix: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          expires_at?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          org_id?: string
          prefix?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          bytes: number
          created_at: string
          filename: string
          id: string
          kind: string
          metadata: Json
          mime: string
          sha256: string | null
          status: string
          storage_path: string
          tags: string[]
          updated_at: string
          upload_url: string | null
          workspace_id: string
        }
        Insert: {
          bytes?: number
          created_at?: string
          filename?: string
          id?: string
          kind: string
          metadata?: Json
          mime: string
          sha256?: string | null
          status?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
          upload_url?: string | null
          workspace_id: string
        }
        Update: {
          bytes?: number
          created_at?: string
          filename?: string
          id?: string
          kind?: string
          metadata?: Json
          mime?: string
          sha256?: string | null
          status?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
          upload_url?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string
          ends_at: string | null
          id: string
          name: string
          org_id: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          ends_at?: string | null
          id?: string
          name: string
          org_id: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string | null
          id?: string
          name?: string
          org_id?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instagram_accounts: {
        Row: {
          created_at: string
          id: string
          label: string | null
          order_item_id: string | null
          org_id: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          order_item_id?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          order_item_id?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          org_id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          resource_id: string | null
          resource_type: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          resource_id?: string | null
          resource_type?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          resource_id?: string | null
          resource_type?: string | null
          title?: string
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string | null
          payload: Json
          type: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id?: string | null
          payload?: Json
          type: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_deliverables: {
        Row: {
          accepted_at: string | null
          created_at: string
          data: Json
          delivered_at: string | null
          delivered_by: string | null
          id: string
          issue_reason: string | null
          issue_reported_at: string | null
          order_item_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          data?: Json
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          issue_reason?: string | null
          issue_reported_at?: string | null
          order_item_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          data?: Json
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          issue_reason?: string | null
          issue_reported_at?: string | null
          order_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_deliverables_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_details: {
        Row: {
          created_at: string
          data: Json
          id: string
          order_item_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          order_item_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          order_item_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_details_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          admin_notes: string | null
          assigned_admin_id: string | null
          cancelled_at: string | null
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string
          position: number
          product_id: string
          ready_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_item_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_admin_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id: string
          position: number
          product_id: string
          ready_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_item_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_admin_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string
          position?: number
          product_id?: string
          ready_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by_user_id: string
          currency: string
          current_period_end: string | null
          delivered_at: string | null
          details_submitted_at: string | null
          id: string
          order_number: number
          org_id: string
          paid_at: string | null
          payment_provider: string
          payment_ref: string | null
          payment_status: Database["public"]["Enums"]["order_payment_status"]
          product_id: string
          quantity: number
          ready_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          unit_price_cents: number
          updated_at: string
          whop_membership_id: string | null
          whop_subscription_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by_user_id: string
          currency?: string
          current_period_end?: string | null
          delivered_at?: string | null
          details_submitted_at?: string | null
          id?: string
          order_number?: number
          org_id: string
          paid_at?: string | null
          payment_provider?: string
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          product_id: string
          quantity: number
          ready_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          unit_price_cents: number
          updated_at?: string
          whop_membership_id?: string | null
          whop_subscription_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by_user_id?: string
          currency?: string
          current_period_end?: string | null
          delivered_at?: string | null
          details_submitted_at?: string | null
          id?: string
          order_number?: number
          org_id?: string
          paid_at?: string | null
          payment_provider?: string
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          product_id?: string
          quantity?: number
          ready_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string
          whop_membership_id?: string | null
          whop_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          billing_interval: string
          code: string
          created_at: string
          currency: string
          deliverable_schema: Json
          description: string | null
          details_schema: Json
          id: string
          name: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_interval?: string
          code: string
          created_at?: string
          currency?: string
          deliverable_schema?: Json
          description?: string | null
          details_schema?: Json
          id?: string
          name: string
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_interval?: string
          code?: string
          created_at?: string
          currency?: string
          deliverable_schema?: Json
          description?: string | null
          details_schema?: Json
          id?: string
          name?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          whop_customer_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          whop_customer_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          whop_customer_id?: string | null
        }
        Relationships: []
      }
      publication_events: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["publication_actor_type"]
          created_at: string
          event_type: string
          id: string
          payload: Json
          publication_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["publication_actor_type"]
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          publication_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["publication_actor_type"]
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_events_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_media: {
        Row: {
          asset_id: string | null
          bunny_library_id: string | null
          bunny_video_id: string | null
          created_at: string
          id: string
          image_url: string | null
          kind: string
          position: number
          publication_id: string
          thumbnail_url: string | null
        }
        Insert: {
          asset_id?: string | null
          bunny_library_id?: string | null
          bunny_video_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind: string
          position?: number
          publication_id: string
          thumbnail_url?: string | null
        }
        Update: {
          asset_id?: string | null
          bunny_library_id?: string | null
          bunny_video_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          position?: number
          publication_id?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_media_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_media_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          account_id: string
          assigned_to: string | null
          campaign_id: string | null
          caption: string
          created_at: string
          created_by: string
          failure_reason: string | null
          hashtags: string[]
          id: string
          instagram_post_url: string | null
          notes: string
          org_id: string
          published_at: string | null
          scheduled_at: string
          source: string
          status: Database["public"]["Enums"]["publication_status"]
          type: Database["public"]["Enums"]["publication_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          campaign_id?: string | null
          caption?: string
          created_at?: string
          created_by: string
          failure_reason?: string | null
          hashtags?: string[]
          id?: string
          instagram_post_url?: string | null
          notes?: string
          org_id: string
          published_at?: string | null
          scheduled_at: string
          source?: string
          status?: Database["public"]["Enums"]["publication_status"]
          type?: Database["public"]["Enums"]["publication_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          campaign_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string
          failure_reason?: string | null
          hashtags?: string[]
          id?: string
          instagram_post_url?: string | null
          notes?: string
          org_id?: string
          published_at?: string | null
          scheduled_at?: string
          source?: string
          status?: Database["public"]["Enums"]["publication_status"]
          type?: Database["public"]["Enums"]["publication_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          account_id: string
          bunny_library_id: string | null
          bunny_video_id: string | null
          caption: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          org_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["post_status"]
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          bunny_library_id?: string | null
          bunny_video_id?: string | null
          caption?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          org_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["post_status"]
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          bunny_library_id?: string | null
          bunny_video_id?: string | null
          caption?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          org_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["post_status"]
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          org_id: string
          quantity: number
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
          whop_membership_id: string | null
          whop_subscription_id: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id: string
          quantity?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
          whop_membership_id?: string | null
          whop_subscription_id?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
          whop_membership_id?: string | null
          whop_subscription_id?: string | null
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
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event: string
          http_status: number | null
          id: string
          next_attempt_at: string | null
          payload: Json
          response_body: string | null
          status: string
          updated_at: string
          webhook_id: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          http_status?: number | null
          id?: string
          next_attempt_at?: string | null
          payload?: Json
          response_body?: string | null
          status?: string
          updated_at?: string
          webhook_id: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          http_status?: number | null
          id?: string
          next_attempt_at?: string | null
          payload?: Json
          response_body?: string | null
          status?: string
          updated_at?: string
          webhook_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          description: string
          events: string[]
          id: string
          secret: string
          status: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          events?: string[]
          id?: string
          secret: string
          status?: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string
          events?: string[]
          id?: string
          secret?: string
          status?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          branding: Json
          created_at: string
          default_locale: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          default_locale?: string
          id: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          default_locale?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
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
      recompute_order_status: {
        Args: { p_order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status:
        | "pending_details"
        | "creating"
        | "warming_up"
        | "ready"
        | "cancelled"
      actor_type: "human" | "ai" | "automation" | "system"
      app_role: "admin" | "client"
      order_item_status:
        | "waiting"
        | "creating"
        | "warming"
        | "ready"
        | "delivered"
        | "cancelled"
      order_payment_status: "pending" | "paid" | "failed" | "refunded"
      order_status:
        | "draft"
        | "awaiting_payment"
        | "awaiting_details"
        | "pending"
        | "in_progress"
        | "ready"
        | "delivered"
        | "cancelled"
      post_status: "scheduled" | "completed" | "cancelled"
      publication_actor_type: "user" | "api_key" | "system"
      publication_status:
        | "draft"
        | "scheduled"
        | "ready_for_publishing"
        | "publishing"
        | "published"
        | "failed"
        | "cancelled"
      publication_type: "reel" | "image" | "carousel" | "video"
      subscription_status: "active" | "past_due" | "cancelled" | "expired"
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
      account_status: [
        "pending_details",
        "creating",
        "warming_up",
        "ready",
        "cancelled",
      ],
      actor_type: ["human", "ai", "automation", "system"],
      app_role: ["admin", "client"],
      order_item_status: [
        "waiting",
        "creating",
        "warming",
        "ready",
        "delivered",
        "cancelled",
      ],
      order_payment_status: ["pending", "paid", "failed", "refunded"],
      order_status: [
        "draft",
        "awaiting_payment",
        "awaiting_details",
        "pending",
        "in_progress",
        "ready",
        "delivered",
        "cancelled",
      ],
      post_status: ["scheduled", "completed", "cancelled"],
      publication_actor_type: ["user", "api_key", "system"],
      publication_status: [
        "draft",
        "scheduled",
        "ready_for_publishing",
        "publishing",
        "published",
        "failed",
        "cancelled",
      ],
      publication_type: ["reel", "image", "carousel", "video"],
      subscription_status: ["active", "past_due", "cancelled", "expired"],
    },
  },
} as const
