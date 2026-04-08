export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          bio: string | null
          avatar: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          bio?: string | null
          avatar?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          bio?: string | null
          avatar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          description: string | null
          is_private: boolean
          invite_code: string | null
          location_point: unknown | null
          address: string | null
          stripe_connect_id: string | null
          stripe_charges_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug?: string
          description?: string | null
          is_private?: boolean
          invite_code?: string | null
          location_point?: unknown | null
          address?: string | null
          stripe_connect_id?: string | null
          stripe_charges_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          slug?: string
          description?: string | null
          is_private?: boolean
          invite_code?: string | null
          location_point?: unknown | null
          address?: string | null
          stripe_connect_id?: string | null
          stripe_charges_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          shop_id: string
          name: string
          description: string | null
          price: number
          image_url: string | null
          stock: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          name: string
          description?: string | null
          price: number
          image_url?: string | null
          stock?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shop_id?: string
          name?: string
          description?: string | null
          price?: number
          image_url?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_shop_accessible: {
        Args: { p_shop_id: string; p_provided_invite: string | null }
        Returns: boolean
      }
      set_invite_code: {
        Args: { code: string }
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Shop = Database['public']['Tables']['shops']['Row']
export type ShopInsert = Database['public']['Tables']['shops']['Insert']
export type ShopUpdate = Database['public']['Tables']['shops']['Update']

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
