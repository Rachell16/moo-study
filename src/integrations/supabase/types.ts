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
      ai_usage: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          alias: string
          code: string
          color: string
          created_at: string
          id: string
          lecturer: string | null
          name: string
          semester: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alias?: string
          code: string
          color?: string
          created_at?: string
          id?: string
          lecturer?: string | null
          name: string
          semester?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alias?: string
          code?: string
          color?: string
          created_at?: string
          id?: string
          lecturer?: string | null
          name?: string
          semester?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          break_minutes: number
          completed: boolean
          completed_at: string | null
          course_id: string | null
          created_at: string
          focus_minutes: number
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          break_minutes?: number
          completed?: boolean
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          focus_minutes: number
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          break_minutes?: number
          completed?: boolean
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          focus_minutes?: number
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          created_at: string
          google_email: string | null
          last_synced_at: string | null
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_email?: string | null
          last_synced_at?: string | null
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_email?: string | null
          last_synced_at?: string | null
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          course_id: string | null
          created_at: string
          exam_scope: string
          file_type: string
          id: string
          material_type: string
          name: string
          outline_generated_at: string | null
          quiz: Json | null
          quiz_generated_at: string | null
          reviewed_at: string | null
          semester: number
          size_bytes: number
          storage_path: string
          study_notes: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          exam_scope?: string
          file_type: string
          id?: string
          material_type?: string
          name: string
          outline_generated_at?: string | null
          quiz?: Json | null
          quiz_generated_at?: string | null
          reviewed_at?: string | null
          semester?: number
          size_bytes?: number
          storage_path: string
          study_notes?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          exam_scope?: string
          file_type?: string
          id?: string
          material_type?: string
          name?: string
          outline_generated_at?: string | null
          quiz?: Json | null
          quiz_generated_at?: string | null
          reviewed_at?: string | null
          semester?: number
          size_bytes?: number
          storage_path?: string
          study_notes?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_components: {
        Row: {
          course_id: string
          created_at: string
          id: string
          name: string
          position: number
          score: number | null
          updated_at: string
          user_id: string
          weight_percent: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          score?: number | null
          updated_at?: string
          user_id: string
          weight_percent: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          score?: number | null
          updated_at?: string
          user_id?: string
          weight_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_components_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      material_points: {
        Row: {
          created_at: string
          heading: string
          id: string
          material_id: string
          page: number | null
          position: number
          summary: string
          understood: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          heading: string
          id?: string
          material_id: string
          page?: number | null
          position: number
          summary: string
          understood?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          heading?: string
          id?: string
          material_id?: string
          page?: number | null
          position?: number
          summary?: string
          understood?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_points_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          material_id: string
          mode: string
          review: Json
          score: number
          total: number
          user_id: string
          wrong: Json
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          material_id: string
          mode: string
          review?: Json
          score: number
          total: number
          user_id: string
          wrong?: Json
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          material_id?: string
          mode?: string
          review?: Json
          score?: number
          total?: number
          user_id?: string
          wrong?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cards: {
        Row: {
          box: number
          correct_count: number
          created_at: string
          due_at: string
          id: string
          last_reviewed_at: string | null
          material_id: string
          qhash: string
          question: Json
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          box?: number
          correct_count?: number
          created_at?: string
          due_at?: string
          id?: string
          last_reviewed_at?: string | null
          material_id: string
          qhash: string
          question: Json
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          box?: number
          correct_count?: number
          created_at?: string
          due_at?: string
          id?: string
          last_reviewed_at?: string | null
          material_id?: string
          qhash?: string
          question?: Json
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_cards_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          activity_type: string
          course_id: string | null
          created_at: string
          done: boolean
          ends_at: string
          exam_kind: string | null
          google_event_id: string | null
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          sync_status: string
          title: string
          updated_at: string
          urgent: boolean
          user_id: string
        }
        Insert: {
          activity_type?: string
          course_id?: string | null
          created_at?: string
          done?: boolean
          ends_at: string
          exam_kind?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          sync_status?: string
          title: string
          updated_at?: string
          urgent?: boolean
          user_id: string
        }
        Update: {
          activity_type?: string
          course_id?: string | null
          created_at?: string
          done?: boolean
          ends_at?: string
          exam_kind?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          sync_status?: string
          title?: string
          updated_at?: string
          urgent?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
