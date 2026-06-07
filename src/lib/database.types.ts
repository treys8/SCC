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
export type DepartmentType = "golf" | "dining" | "tennis" | "general";
export type ReservationStatus = "pending" | "confirmed" | "cancelled";

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
          title: string;
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
          title: string;
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
          title?: string;
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
      reservations: {
        Row: {
          id: string;
          member_id: string;
          reservation_date: string;
          reservation_time: string;
          party_size: number;
          special_requests: string | null;
          status: ReservationStatus;
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
    };
    Views: Record<never, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
    };
    Enums: {
      user_role: UserRole;
      department_type: DepartmentType;
    };
    CompositeTypes: Record<never, never>;
  };
}

/** Convenience row aliases */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type CalendarEvent =
  Database["public"]["Tables"]["calendar_events"]["Row"];
