export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          slug: string;
          name: string;
          starts_at: string;
          ends_at: string;
          lifecycle_state: "pre_event" | "event_day" | "post_event_archive";
          brand_tokens: Json;
          feature_flags: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          starts_at: string;
          ends_at: string;
          lifecycle_state?: "pre_event" | "event_day" | "post_event_archive";
          brand_tokens?: Json;
          feature_flags?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string | null;
          role: string;
          real_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          role?: string;
          real_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          actor_role: string;
          action: string;
          target_type: string;
          target_id: string | null;
          reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          actor_role: string;
          action: string;
          target_type: string;
          target_id?: string | null;
          reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      attendees: {
        Row: {
          id: string;
          event_id: string;
          auth_user_id: string;
          email: string | null;
          real_name: string | null;
          business_name: string | null;
          phone: string | null;
          alias: string;
          is_verified: boolean;
          checked_in_at: string | null;
          competition_score: number;
          spendable_balance: number;
          reached_current_score_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          auth_user_id: string;
          email?: string | null;
          real_name?: string | null;
          business_name?: string | null;
          phone?: string | null;
          alias: string;
          is_verified?: boolean;
          checked_in_at?: string | null;
          competition_score?: number;
          spendable_balance?: number;
          reached_current_score_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendees"]["Insert"]>;
        Relationships: [];
      };
      pending_scans: {
        Row: {
          id: string;
          event_id: string;
          auth_user_id: string;
          qr_code_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          auth_user_id: string;
          qr_code_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pending_scans"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      events_public: {
        Row: {
          id: string;
          slug: string;
          name: string;
          starts_at: string;
          ends_at: string;
          lifecycle_state: "pre_event" | "event_day" | "post_event_archive";
          brand_tokens: Json;
          feature_flags: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      event_lifecycle_state: "pre_event" | "event_day" | "post_event_archive";
      app_role: "attendee" | "staff" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};
