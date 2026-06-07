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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      user_role: UserRole;
      department_type: DepartmentType;
      attachment_kind: AttachmentKind;
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
