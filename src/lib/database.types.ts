/**
 * Hand-written types mirroring the SCC Supabase schema
 * (see supabase/migrations). Regenerate with the CLI once linked:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "member" | "staff" | "admin";
export type DepartmentType =
  | "golf"
  | "dining"
  | "tennis"
  | "general"
  | "pool"
  | "social"
  | "pro_shop"
  | "membership";
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled";
export type AttachmentKind = "image" | "file";
/** Whose voice a feed post is in: the club ("official") or an individual member. */
export type PostAuthorType = "club" | "member";
export type FacilityType = "golf" | "pool" | "tennis" | "driving_range";
export type FacilityStatusType =
  | "open"
  | "closed"
  | "frost_delay"
  | "rain_delay"
  | "lightning_hold";
/** One labelled row in a facility's conditions list (stored as jsonb). */
export type FacilityDetail = { label: string; value: string };
/** Document-library grouping (text + CHECK in the DB, not a PG enum). */
export type DocumentCategory =
  | "menu"
  | "pool"
  | "newsletter"
  | "form"
  | "general";
/** A golf-log entry is either a logged accomplishment or a trackable issue. */
export type GolfLogKind = "done" | "issue";
/** A buffet dish is either a main or a side (text + CHECK in the DB). */
export type DishKind = "main" | "side";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          display_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          phone: string | null;
          account_number: string | null;
          title_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          display_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          account_number?: string | null;
          title_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          display_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          account_number?: string | null;
          title_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_account_number_fkey";
            columns: ["account_number"];
            referencedRelation: "accounts";
            referencedColumns: ["account_number"];
          },
          {
            foreignKeyName: "profiles_title_id_fkey";
            columns: ["title_id"];
            referencedRelation: "staff_titles";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          account_number: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          account_number: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          account_number?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_titles: {
        Row: {
          id: string;
          name: string;
          department: DepartmentType;
          max_holders: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          department: DepartmentType;
          max_holders?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          department?: DepartmentType;
          max_holders?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          author_type: PostAuthorType;
          department: DepartmentType;
          title: string | null;
          content: string;
          image_url: string | null;
          pdf_url: string | null;
          event_id: string | null;
          reservation_cta: boolean;
          reservation_required_date: string | null;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          author_type?: PostAuthorType;
          department: DepartmentType;
          title?: string | null;
          content: string;
          image_url?: string | null;
          pdf_url?: string | null;
          event_id?: string | null;
          reservation_cta?: boolean;
          reservation_required_date?: string | null;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          author_type?: PostAuthorType;
          department?: DepartmentType;
          title?: string | null;
          content?: string;
          image_url?: string | null;
          pdf_url?: string | null;
          event_id?: string | null;
          reservation_cta?: boolean;
          reservation_required_date?: string | null;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "calendar_events";
            referencedColumns: ["id"];
          },
        ];
      };
      post_attachments: {
        Row: {
          id: string;
          post_id: string;
          kind: AttachmentKind;
          url: string;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          width: number | null;
          height: number | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          kind: AttachmentKind;
          url: string;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          width?: number | null;
          height?: number | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          kind?: AttachmentKind;
          url?: string;
          storage_path?: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          width?: number | null;
          height?: number | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_attachments_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          member_id: string;
          reservation_date: string;
          reservation_time: string;
          party_size: number;
          special_requests: string | null;
          status: ReservationStatus;
          table_id: string | null;
          staff_note: string | null;
          proposed_date: string | null;
          proposed_time: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          reservation_date: string;
          reservation_time: string;
          party_size: number;
          special_requests?: string | null;
          status?: ReservationStatus;
          table_id?: string | null;
          staff_note?: string | null;
          proposed_date?: string | null;
          proposed_time?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          reservation_date?: string;
          reservation_time?: string;
          party_size?: number;
          special_requests?: string | null;
          status?: ReservationStatus;
          table_id?: string | null;
          staff_note?: string | null;
          proposed_date?: string | null;
          proposed_time?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          event_date: string;
          start_time: string;
          end_time: string | null;
          location: string | null;
          department: DepartmentType | null;
          registration_url: string | null;
          fee: string | null;
          cover_image_url: string | null;
          is_highlight: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          event_date: string;
          start_time: string;
          end_time?: string | null;
          location?: string | null;
          department?: DepartmentType | null;
          registration_url?: string | null;
          fee?: string | null;
          cover_image_url?: string | null;
          is_highlight?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          event_date?: string;
          start_time?: string;
          end_time?: string | null;
          location?: string | null;
          department?: DepartmentType | null;
          registration_url?: string | null;
          fee?: string | null;
          cover_image_url?: string | null;
          is_highlight?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dining_tables: {
        Row: {
          id: string;
          name: string;
          seats: number;
          section: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          seats: number;
          section?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          seats?: number;
          section?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      reservation_settings: {
        Row: {
          id: number;
          slot_minutes: number;
          service_start: string;
          service_end: string;
          max_reservations_per_slot: number;
          max_covers_per_slot: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          slot_minutes?: number;
          service_start?: string;
          service_end?: string;
          max_reservations_per_slot?: number;
          max_covers_per_slot?: number;
          updated_at?: string;
        };
        Update: {
          id?: number;
          slot_minutes?: number;
          service_start?: string;
          service_end?: string;
          max_reservations_per_slot?: number;
          max_covers_per_slot?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          reservation_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          reservation_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          reservation_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_reservation_id_fkey";
            columns: ["reservation_id"];
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      facility_status: {
        Row: {
          facility: FacilityType;
          status: FacilityStatusType;
          message: string | null;
          details: FacilityDetail[];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          facility: FacilityType;
          status?: FacilityStatusType;
          message?: string | null;
          details?: FacilityDetail[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          facility?: FacilityType;
          status?: FacilityStatusType;
          message?: string | null;
          details?: FacilityDetail[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "facility_status_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dining_buffet: {
        Row: {
          id: boolean;
          title: string;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          price: string | null;
          description: string | null;
          walk_in: boolean;
          active: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          title?: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          price?: string | null;
          description?: string | null;
          walk_in?: boolean;
          active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          title?: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          price?: string | null;
          description?: string | null;
          walk_in?: boolean;
          active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dining_buffet_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dining_brunch: {
        Row: {
          id: boolean;
          title: string;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          price: string | null;
          description: string | null;
          walk_in: boolean;
          active: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          title?: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          price?: string | null;
          description?: string | null;
          walk_in?: boolean;
          active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          title?: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          price?: string | null;
          description?: string | null;
          walk_in?: boolean;
          active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dining_brunch_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dishes: {
        Row: {
          id: string;
          name: string;
          kind: DishKind;
          active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          kind: DishKind;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          kind?: DishKind;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dishes_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buffet_week: {
        Row: {
          weekday: number;
          main_dish_id: string | null;
          note: string | null;
          is_closed: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          weekday: number;
          main_dish_id?: string | null;
          note?: string | null;
          is_closed?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          weekday?: number;
          main_dish_id?: string | null;
          note?: string | null;
          is_closed?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "buffet_week_main_dish_id_fkey";
            columns: ["main_dish_id"];
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buffet_week_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      buffet_week_sides: {
        Row: {
          weekday: number;
          dish_id: string;
          position: number;
        };
        Insert: {
          weekday: number;
          dish_id: string;
          position?: number;
        };
        Update: {
          weekday?: number;
          dish_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "buffet_week_sides_weekday_fkey";
            columns: ["weekday"];
            referencedRelation: "buffet_week";
            referencedColumns: ["weekday"];
          },
          {
            foreignKeyName: "buffet_week_sides_dish_id_fkey";
            columns: ["dish_id"];
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
        ];
      };
      member_department_preferences: {
        Row: {
          user_id: string;
          department: DepartmentType;
          created_at: string;
        };
        Insert: {
          user_id: string;
          department: DepartmentType;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          department?: DepartmentType;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_department_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          failure_count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          failure_count?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          failure_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_directory: {
        Row: {
          id: string;
          full_name: string;
          title: string;
          email: string | null;
          phone: string | null;
          department: DepartmentType | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          title: string;
          email?: string | null;
          phone?: string | null;
          department?: DepartmentType | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          title?: string;
          email?: string | null;
          phone?: string | null;
          department?: DepartmentType | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_info: {
        Row: {
          id: boolean;
          street_address: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          mailing_address: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          street_address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          mailing_address?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          street_address?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          mailing_address?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_info_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_settings: {
        Row: {
          id: boolean;
          conditions_reminder_enabled: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          conditions_reminder_enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          conditions_reminder_enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_settings_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          title: string;
          category: DocumentCategory;
          file_url: string;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          cover_image_url: string | null;
          is_published: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: DocumentCategory;
          file_url: string;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          cover_image_url?: string | null;
          is_published?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: DocumentCategory;
          file_url?: string;
          storage_path?: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          cover_image_url?: string | null;
          is_published?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_messages: {
        Row: {
          id: string;
          member_id: string;
          subject: string;
          message: string;
          is_resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          subject: string;
          message: string;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          subject?: string;
          message?: string;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_messages_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_messages_resolved_by_fkey";
            columns: ["resolved_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      golf_log_entries: {
        Row: {
          id: string;
          author_id: string;
          entry_date: string;
          kind: GolfLogKind;
          area: string | null;
          note: string;
          photo_url: string | null;
          resolved: boolean;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          entry_date?: string;
          kind: GolfLogKind;
          area?: string | null;
          note: string;
          photo_url?: string | null;
          resolved?: boolean;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          entry_date?: string;
          kind?: GolfLogKind;
          area?: string | null;
          note?: string;
          photo_url?: string | null;
          resolved?: boolean;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "golf_log_entries_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      golf_log_comments: {
        Row: {
          id: string;
          entry_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          entry_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "golf_log_comments_entry_id_fkey";
            columns: ["entry_id"];
            referencedRelation: "golf_log_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "golf_log_comments_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      /** Name + avatar only, readable by any member (see security_hardening migration). */
      member_cards: {
        Row: {
          id: string | null;
          full_name: string | null;
          avatar_url: string | null;
          title: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      /** Atomically replace a member's department opt-ins. */
      set_member_department_preferences: {
        Args: { p_departments: DepartmentType[] };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      department_type: DepartmentType;
      attachment_kind: AttachmentKind;
      post_author_type: PostAuthorType;
    };
    CompositeTypes: Record<never, never>;
  };
}

/** Convenience row aliases */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostAttachment =
  Database["public"]["Tables"]["post_attachments"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type CalendarEvent =
  Database["public"]["Tables"]["calendar_events"]["Row"];
export type DiningTable =
  Database["public"]["Tables"]["dining_tables"]["Row"];
export type ReservationSettings =
  Database["public"]["Tables"]["reservation_settings"]["Row"];
export type Notification =
  Database["public"]["Tables"]["notifications"]["Row"];
export type FacilityStatus =
  Database["public"]["Tables"]["facility_status"]["Row"];
export type DiningBuffet =
  Database["public"]["Tables"]["dining_buffet"]["Row"];

export type DiningBrunch =
  Database["public"]["Tables"]["dining_brunch"]["Row"];
export type Dish = Database["public"]["Tables"]["dishes"]["Row"];
export type BuffetWeekDay =
  Database["public"]["Tables"]["buffet_week"]["Row"];
export type MemberDepartmentPreference =
  Database["public"]["Tables"]["member_department_preferences"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type StaffMember =
  Database["public"]["Tables"]["staff_directory"]["Row"];
export type ClubInfo = Database["public"]["Tables"]["club_info"]["Row"];
export type ClubSettings =
  Database["public"]["Tables"]["club_settings"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type ContactMessage =
  Database["public"]["Tables"]["contact_messages"]["Row"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type StaffTitle = Database["public"]["Tables"]["staff_titles"]["Row"];
export type GolfLogEntry =
  Database["public"]["Tables"]["golf_log_entries"]["Row"];
export type GolfLogComment =
  Database["public"]["Tables"]["golf_log_comments"]["Row"];

/** A profile with its staff title joined, as listed on the Members page. */
export type MemberWithTitle = Profile & {
  title: Pick<StaffTitle, "name"> | null;
};

/** An account plus who's on it — drives the invite form's typo-catching hint. */
export type AccountSummary = Account & {
  member_names: string[];
};

/** A contact message with the sender's name + email joined for the staff inbox. */
export type ContactMessageWithMember = ContactMessage & {
  member: Pick<Profile, "full_name" | "email"> | null;
};

/**
 * Just the author fields the feed renders. `title` is the staff title name
 * (from member_cards, joined to staff_titles) — null for members and titleless
 * staff. Not a Pick of Profile since Profile has no title column.
 */
export type PostAuthor = {
  full_name: string;
  avatar_url: string | null;
  title: string | null;
};

/**
 * A post as rendered in the feed: its attachments (ordered by `position`), the
 * author's display fields, and an optional referenced calendar event (its
 * Register button renders inline) — all joined in a single Supabase query.
 */
export type FeedPost = Post & {
  post_attachments: PostAttachment[];
  author: PostAuthor | null;
  event: CalendarEvent | null;
};
