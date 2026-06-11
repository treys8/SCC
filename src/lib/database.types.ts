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
export type FacilityType = "golf" | "pool" | "tennis";
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
          created_at?: string;
          updated_at?: string;
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
    };
    Views: {
      /** Name + avatar only, readable by any member (see security_hardening migration). */
      member_cards: {
        Row: {
          id: string | null;
          full_name: string | null;
          avatar_url: string | null;
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
export type MemberDepartmentPreference =
  Database["public"]["Tables"]["member_department_preferences"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type StaffMember =
  Database["public"]["Tables"]["staff_directory"]["Row"];
export type ClubInfo = Database["public"]["Tables"]["club_info"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

/** Just the author fields the feed renders. */
export type PostAuthor = Pick<Profile, "full_name" | "avatar_url">;

/**
 * A post as rendered in the feed: its attachments (ordered by `position`) and
 * the author's display fields, joined in a single Supabase query.
 */
export type FeedPost = Post & {
  post_attachments: PostAttachment[];
  author: PostAuthor | null;
};
