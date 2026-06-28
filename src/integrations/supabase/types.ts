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
      attendance_logs: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          gym_id: string
          id: string
          member_id: string
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          gym_id: string
          id?: string
          member_id: string
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          gym_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_logs: {
        Row: {
          completed: boolean
          created_at: string
          exercise_id: string
          id: string
          log_id: string
          reps: number | null
          set_number: number
          weight: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          exercise_id: string
          id?: string
          log_id: string
          reps?: number | null
          set_number: number
          weight?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          exercise_id?: string
          id?: string
          log_id?: string
          reps?: number | null
          set_number?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string | null
          equipment: string[] | null
          gym_id: string | null
          id: string
          muscle_groups: string[] | null
          name: string
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          equipment?: string[] | null
          gym_id?: string | null
          id?: string
          muscle_groups?: string[] | null
          name: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          equipment?: string[] | null
          gym_id?: string | null
          id?: string
          muscle_groups?: string[] | null
          name?: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_assessments: {
        Row: {
          arms: number | null
          bench_1rm: number | null
          blood_pressure: string | null
          bmi: number | null
          body_fat_pct: number | null
          chest: number | null
          created_at: string
          date: string
          deadlift_1rm: number | null
          flexibility: number | null
          gym_id: string
          height: number | null
          hips: number | null
          id: string
          member_id: string
          muscle_mass: number | null
          notes: string | null
          resting_hr: number | null
          squat_1rm: number | null
          thighs: number | null
          trainer_id: string | null
          unit_system: string
          vo2_max: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          arms?: number | null
          bench_1rm?: number | null
          blood_pressure?: string | null
          bmi?: number | null
          body_fat_pct?: number | null
          chest?: number | null
          created_at?: string
          date?: string
          deadlift_1rm?: number | null
          flexibility?: number | null
          gym_id: string
          height?: number | null
          hips?: number | null
          id?: string
          member_id: string
          muscle_mass?: number | null
          notes?: string | null
          resting_hr?: number | null
          squat_1rm?: number | null
          thighs?: number | null
          trainer_id?: string | null
          unit_system?: string
          vo2_max?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arms?: number | null
          bench_1rm?: number | null
          blood_pressure?: string | null
          bmi?: number | null
          body_fat_pct?: number | null
          chest?: number | null
          created_at?: string
          date?: string
          deadlift_1rm?: number | null
          flexibility?: number | null
          gym_id?: string
          height?: number | null
          hips?: number | null
          id?: string
          member_id?: string
          muscle_mass?: number | null
          notes?: string | null
          resting_hr?: number | null
          squat_1rm?: number | null
          thighs?: number | null
          trainer_id?: string | null
          unit_system?: string
          vo2_max?: number | null
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_assessments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_assessments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_assessments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          created_at: string
          custom_domain: string | null
          font_family: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
        }
        Relationships: []
      }
      member_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          gym_id: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          gym_id: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          created_at: string
          dob: string | null
          emergency_contact: Json | null
          experience_level: string | null
          gender: string | null
          goals: string | null
          health_notes: string | null
          membership_expires_at: string | null
          membership_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dob?: string | null
          emergency_contact?: Json | null
          experience_level?: string | null
          gender?: string | null
          goals?: string | null
          health_notes?: string | null
          membership_expires_at?: string | null
          membership_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dob?: string | null
          emergency_contact?: Json | null
          experience_level?: string | null
          gender?: string | null
          goals?: string | null
          health_notes?: string | null
          membership_expires_at?: string | null
          membership_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_assignments: {
        Row: {
          active: boolean
          assigned_at: string
          gym_id: string
          id: string
          member_id: string
          trainer_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          gym_id: string
          id?: string
          member_id: string
          trainer_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_assignments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_assignments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          gym_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          gym_id: string | null
          id: string
          phone: string | null
          photo_url: string | null
          push_subscription: Json | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          gym_id?: string | null
          id: string
          phone?: string | null
          photo_url?: string | null
          push_subscription?: Json | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          gym_id?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          push_subscription?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "users_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          created_at: string
          day_label: string
          id: string
          order: number
          plan_id: string
        }
        Insert: {
          created_at?: string
          day_label: string
          id?: string
          order?: number
          plan_id: string
        }
        Update: {
          created_at?: string
          day_label?: string
          id?: string
          order?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          day_id: string
          exercise_id: string
          id: string
          notes: string | null
          order: number
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          tempo: string | null
        }
        Insert: {
          created_at?: string
          day_id: string
          exercise_id: string
          id?: string
          notes?: string | null
          order?: number
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          tempo?: string | null
        }
        Update: {
          created_at?: string
          day_id?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          order?: number
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          tempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          date: string
          effort_rating: number | null
          gym_id: string
          id: string
          member_id: string
          notes: string | null
          plan_id: string | null
          synced_offline: boolean
          workout_day_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date?: string
          effort_rating?: number | null
          gym_id: string
          id?: string
          member_id: string
          notes?: string | null
          plan_id?: string | null
          synced_offline?: boolean
          workout_day_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date?: string
          effort_rating?: number | null
          gym_id?: string
          id?: string
          member_id?: string
          notes?: string | null
          plan_id?: string | null
          synced_offline?: boolean
          workout_day_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          duration_weeks: number | null
          gym_id: string
          id: string
          is_template: boolean
          member_id: string
          name: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["plan_status"]
          trainer_id: string | null
        }
        Insert: {
          created_at?: string
          duration_weeks?: number | null
          gym_id: string
          id?: string
          is_template?: boolean
          member_id: string
          name: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          trainer_id?: string | null
        }
        Update: {
          created_at?: string
          duration_weeks?: number | null
          gym_id?: string
          id?: string
          is_template?: boolean
          member_id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_gym_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trainer_of: { Args: { _member_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "trainer" | "member"
      plan_status: "active" | "archived"
      subscription_plan: "starter" | "growth" | "pro" | "chain"
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
      app_role: ["admin", "trainer", "member"],
      plan_status: ["active", "archived"],
      subscription_plan: ["starter", "growth", "pro", "chain"],
    },
  },
} as const
