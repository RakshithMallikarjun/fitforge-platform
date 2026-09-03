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
      ai_overload_cache: {
        Row: {
          cache_key: string
          created_at: string
          id: string
          member_id: string
          payload: Json
          requested_by: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          id?: string
          member_id: string
          payload: Json
          requested_by: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          id?: string
          member_id?: string
          payload?: Json
          requested_by?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          gym_id: string
          id: string
          location_type: string | null
          member_id: string
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          gym_id: string
          id?: string
          location_type?: string | null
          member_id: string
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          gym_id?: string
          id?: string
          location_type?: string | null
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
      goals: {
        Row: {
          achieved_at: string | null
          created_at: string
          current_value: number | null
          gym_id: string
          id: string
          member_id: string
          name: string
          target_date: string | null
          target_value: number | null
          unit: string | null
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          current_value?: number | null
          gym_id: string
          id?: string
          member_id: string
          name: string
          target_date?: string | null
          target_value?: number | null
          unit?: string | null
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          current_value?: number | null
          gym_id?: string
          id?: string
          member_id?: string
          name?: string
          target_date?: string | null
          target_value?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          billing_email: string | null
          created_at: string
          currency: string
          custom_domain: string | null
          disabled_at: string | null
          disabled_reason: string | null
          font_family: string | null
          id: string
          internal_note: string | null
          is_enabled: boolean
          join_code: string | null
          last_payment_at: string | null
          logo_url: string | null
          monthly_amount: number | null
          name: string
          next_due_at: string | null
          payment_status: Database["public"]["Enums"]["gym_payment_status"]
          primary_color: string | null
          secondary_color: string | null
          slug: string
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          support_email: string | null
          support_phone: string | null
          timezone: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          currency?: string
          custom_domain?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          font_family?: string | null
          id?: string
          internal_note?: string | null
          is_enabled?: boolean
          join_code?: string | null
          last_payment_at?: string | null
          logo_url?: string | null
          monthly_amount?: number | null
          name: string
          next_due_at?: string | null
          payment_status?: Database["public"]["Enums"]["gym_payment_status"]
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          support_email?: string | null
          support_phone?: string | null
          timezone?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          currency?: string
          custom_domain?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          font_family?: string | null
          id?: string
          internal_note?: string | null
          is_enabled?: boolean
          join_code?: string | null
          last_payment_at?: string | null
          logo_url?: string | null
          monthly_amount?: number | null
          name?: string
          next_due_at?: string | null
          payment_status?: Database["public"]["Enums"]["gym_payment_status"]
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          support_email?: string | null
          support_phone?: string | null
          timezone?: string
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
          billing_cycle: string | null
          created_at: string
          dob: string | null
          emergency_contact: Json | null
          experience_level: string | null
          gender: string | null
          goals: string | null
          health_notes: string | null
          last_payment_amount: number | null
          last_payment_date: string | null
          membership_expires_at: string | null
          membership_type: string | null
          payment_confirmed: boolean
          payment_notes: string | null
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact?: Json | null
          experience_level?: string | null
          gender?: string | null
          goals?: string | null
          health_notes?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          membership_expires_at?: string | null
          membership_type?: string | null
          payment_confirmed?: boolean
          payment_notes?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact?: Json | null
          experience_level?: string | null
          gender?: string | null
          goals?: string | null
          health_notes?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          membership_expires_at?: string | null
          membership_type?: string | null
          payment_confirmed?: boolean
          payment_notes?: string | null
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
      messages: {
        Row: {
          body: string
          created_at: string
          gym_id: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          gym_id: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          gym_id?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      overload_suggestions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          exercise_id: string
          id: string
          member_id: string
          plan_id: string
          suggestion: Json
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          exercise_id: string
          id?: string
          member_id: string
          plan_id: string
          suggestion: Json
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          exercise_id?: string
          id?: string
          member_id?: string
          plan_id?: string
          suggestion?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overload_suggestions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overload_suggestions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          achieved_at: string
          created_at: string
          exercise_id: string
          gym_id: string
          id: string
          log_id: string | null
          member_id: string
          reps: number | null
          weight: number
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          exercise_id: string
          gym_id: string
          id?: string
          log_id?: string | null
          member_id: string
          reps?: number | null
          weight: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          exercise_id?: string
          gym_id?: string
          id?: string
          log_id?: string | null
          member_id?: string
          reps?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json | null
          gym_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json | null
          gym_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json | null
          gym_id?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          assessment_id: string | null
          created_at: string
          gym_id: string
          id: string
          member_id: string
          photo_url: string
          taken_at: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          gym_id: string
          id?: string
          member_id: string
          photo_url: string
          taken_at?: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          photo_url?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "fitness_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_photos_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_photos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
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
          last_sign_in_at: string | null
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
          last_sign_in_at?: string | null
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
          last_sign_in_at?: string | null
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
          block_type: string | null
          created_at: string
          day_label: string
          id: string
          order: number
          plan_id: string
        }
        Insert: {
          block_type?: string | null
          created_at?: string
          day_label: string
          id?: string
          order?: number
          plan_id: string
        }
        Update: {
          block_type?: string | null
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
      workout_exercise_substitutions: {
        Row: {
          created_at: string
          id: string
          member_id: string
          original_workout_exercise_id: string
          substitute_exercise_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          original_workout_exercise_id: string
          substitute_exercise_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          original_workout_exercise_id?: string
          substitute_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercise_substitution_original_workout_exercise_id_fkey"
            columns: ["original_workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_substitutions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercise_substitutions_substitute_exercise_id_fkey"
            columns: ["substitute_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
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
      platform_activity_days: {
        Row: {
          day: string | null
          gym_id: string | null
          is_checkin: number | null
          is_workout: number | null
          member_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      attendance_buckets: {
        Args: { _end: string; _gym_id: string; _start: string }
        Returns: {
          cnt: number
          day: string
          hour: number
          member_id: string
        }[]
      }
      current_gym_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_trainer_of: { Args: { _member_id: string }; Returns: boolean }
      my_gym_enabled: { Args: never; Returns: boolean }
      platform_activity_trend: {
        Args: { _days?: number }
        Returns: {
          active_members: number
          checkins: number
          day: string
          workouts: number
        }[]
      }
      platform_audit_recent: {
        Args: { _gym_id?: string; _limit?: number }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          detail: Json
          gym_id: string
          gym_name: string
          id: number
        }[]
      }
      platform_feature_adoption: { Args: never; Returns: Json }
      platform_gym_activity_trend: {
        Args: { _days?: number; _gym_id: string }
        Returns: {
          checkins: number
          day: string
          workouts: number
        }[]
      }
      platform_gym_admins: {
        Args: never
        Returns: {
          active: boolean
          display_name: string
          email: string
          gym_id: string
          gym_name: string
          gym_slug: string
          is_enabled: boolean
          last_sign_in_at: string
          phone: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      platform_gym_detail: { Args: { _gym_id: string }; Returns: Json }
      platform_gyms: {
        Args: never
        Returns: {
          active_member_count: number
          active_member_ratio: number
          admin_count: number
          assessed_90d_ratio: number
          assessments_30d: number
          checkin_rate_30d: number
          checkins_30d: number
          checkins_7d: number
          created_at: string
          currency: string
          custom_domain: string
          days_since_activity: number
          disabled_at: string
          health_score: number
          id: string
          is_enabled: boolean
          last_activity_at: string
          last_payment_at: string
          member_count: number
          members_per_trainer: number
          monthly_amount: number
          name: string
          next_due_at: string
          payment_status: Database["public"]["Enums"]["gym_payment_status"]
          plan_coverage: number
          plans_30d: number
          slug: string
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          timezone: string
          trainer_count: number
          workouts_30d: number
          workouts_7d: number
          workouts_per_active_member_30d: number
        }[]
      }
      platform_overview: { Args: never; Returns: Json }
      platform_retention_cohorts: {
        Args: { _months?: number }
        Returns: {
          active_m1: number
          active_m2: number
          active_m3: number
          cohort_month: string
          cohort_size: number
        }[]
      }
      platform_set_gym_enabled: {
        Args: { _enabled: boolean; _gym_id: string; _reason?: string }
        Returns: undefined
      }
      platform_set_gym_plan: {
        Args: {
          _gym_id: string
          _plan: Database["public"]["Enums"]["subscription_plan"]
        }
        Returns: undefined
      }
      platform_set_payment_status: {
        Args: {
          _currency?: string
          _gym_id: string
          _last_payment_at?: string
          _monthly_amount?: number
          _next_due_at?: string
          _note?: string
          _status: Database["public"]["Enums"]["gym_payment_status"]
        }
        Returns: undefined
      }
      platform_signup_trend: {
        Args: { _days?: number }
        Returns: {
          day: string
          gyms_created: number
          members_created: number
        }[]
      }
      touch_last_sign_in: { Args: never; Returns: undefined }
      verify_join_code: {
        Args: { _code: string; _slug: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trainer" | "member"
      gym_payment_status:
        | "trialing"
        | "paid"
        | "pending"
        | "overdue"
        | "failed"
        | "cancelled"
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
      app_role: ["admin", "trainer", "member"],
      gym_payment_status: [
        "trialing",
        "paid",
        "pending",
        "overdue",
        "failed",
        "cancelled",
      ],
      plan_status: ["active", "archived"],
      subscription_plan: ["starter", "growth", "pro", "chain"],
    },
  },
} as const
