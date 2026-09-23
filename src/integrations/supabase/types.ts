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
      ad_daily_stats: {
        Row: {
          ad_id: string
          clicks: number
          day: string
          gym_id: string
          impressions: number
        }
        Insert: {
          ad_id: string
          clicks?: number
          day: string
          gym_id: string
          impressions?: number
        }
        Update: {
          ad_id?: string
          clicks?: number
          day?: string
          gym_id?: string
          impressions?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_stats_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_daily_stats_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          advertiser_name: string
          body: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          ends_on: string | null
          gym_id: string | null
          headline: string
          id: string
          image_path: string | null
          placement: Database["public"]["Enums"]["ad_placement"]
          priority: number
          starts_on: string
          status: Database["public"]["Enums"]["ad_status"]
        }
        Insert: {
          advertiser_name: string
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_on?: string | null
          gym_id?: string | null
          headline: string
          id?: string
          image_path?: string | null
          placement?: Database["public"]["Enums"]["ad_placement"]
          priority?: number
          starts_on: string
          status?: Database["public"]["Enums"]["ad_status"]
        }
        Update: {
          advertiser_name?: string
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_on?: string | null
          gym_id?: string | null
          headline?: string
          id?: string
          image_path?: string | null
          placement?: Database["public"]["Enums"]["ad_placement"]
          priority?: number
          starts_on?: string
          status?: Database["public"]["Enums"]["ad_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ads_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_plan_generations: {
        Row: {
          created_at: string
          created_by: string | null
          gym_day: string
          gym_id: string
          id: string
          member_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gym_day: string
          gym_id: string
          id?: string
          member_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gym_day?: string
          gym_id?: string
          id?: string
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_plan_generations_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plan_generations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      daily_summary_log: {
        Row: {
          gym_id: string
          id: number
          recipient_count: number
          sent_at: string
          skipped_reason: string | null
          summary_date: string
          totals: Json | null
        }
        Insert: {
          gym_id: string
          id?: number
          recipient_count?: number
          sent_at?: string
          skipped_reason?: string | null
          summary_date: string
          totals?: Json | null
        }
        Update: {
          gym_id?: string
          id?: number
          recipient_count?: number
          sent_at?: string
          skipped_reason?: string | null
          summary_date?: string
          totals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_summary_log_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
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
      gym_ad_blocklist: {
        Row: {
          ad_id: string
          created_at: string
          gym_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          gym_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          gym_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_ad_blocklist_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_ad_blocklist_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_ad_settings: {
        Row: {
          ads_enabled: boolean
          allow_platform_fill: boolean
          gym_id: string
          max_per_member_day: number
          revenue_note: string | null
          updated_at: string
        }
        Insert: {
          ads_enabled?: boolean
          allow_platform_fill?: boolean
          gym_id: string
          max_per_member_day?: number
          revenue_note?: string | null
          updated_at?: string
        }
        Update: {
          ads_enabled?: boolean
          allow_platform_fill?: boolean
          gym_id?: string
          max_per_member_day?: number
          revenue_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_ad_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_billing_settings: {
        Row: {
          admin_digest_enabled: boolean
          auto_remind_members: boolean
          daily_summary_enabled: boolean
          daily_summary_hour: number
          grace_days: number
          gym_id: string
          reminder_lead_days: number
          reminder_template: string
          updated_at: string
        }
        Insert: {
          admin_digest_enabled?: boolean
          auto_remind_members?: boolean
          daily_summary_enabled?: boolean
          daily_summary_hour?: number
          grace_days?: number
          gym_id: string
          reminder_lead_days?: number
          reminder_template?: string
          updated_at?: string
        }
        Update: {
          admin_digest_enabled?: boolean
          auto_remind_members?: boolean
          daily_summary_enabled?: boolean
          daily_summary_hour?: number
          grace_days?: number
          gym_id?: string
          reminder_lead_days?: number
          reminder_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_billing_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string | null
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
          owner_claimed_at: string | null
          owner_invited_at: string | null
          payment_status: Database["public"]["Enums"]["gym_payment_status"]
          pending_owner_email: string | null
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
          created_by?: string | null
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
          owner_claimed_at?: string | null
          owner_invited_at?: string | null
          payment_status?: Database["public"]["Enums"]["gym_payment_status"]
          pending_owner_email?: string | null
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
          created_by?: string | null
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
          owner_claimed_at?: string | null
          owner_invited_at?: string | null
          payment_status?: Database["public"]["Enums"]["gym_payment_status"]
          pending_owner_email?: string | null
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
          shared_with_member: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          gym_id: string
          id?: string
          member_id: string
          shared_with_member?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          shared_with_member?: boolean
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
      member_payments: {
        Row: {
          amount: number
          covers_from: string
          covers_to: string
          created_at: string
          currency: string
          gym_id: string
          id: string
          member_id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_on: string
          period_snapshot: Database["public"]["Enums"]["billing_period"]
          plan_id: string | null
          plan_name_snapshot: string
          provider: string
          provider_ref: string | null
          recorded_by: string | null
          reference: string | null
          refund_of: string | null
          state: Database["public"]["Enums"]["payment_state"]
          subscription_id: string | null
        }
        Insert: {
          amount: number
          covers_from: string
          covers_to: string
          created_at?: string
          currency: string
          gym_id: string
          id?: string
          member_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on: string
          period_snapshot: Database["public"]["Enums"]["billing_period"]
          plan_id?: string | null
          plan_name_snapshot: string
          provider?: string
          provider_ref?: string | null
          recorded_by?: string | null
          reference?: string | null
          refund_of?: string | null
          state?: Database["public"]["Enums"]["payment_state"]
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          covers_from?: string
          covers_to?: string
          created_at?: string
          currency?: string
          gym_id?: string
          id?: string
          member_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on?: string
          period_snapshot?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string | null
          plan_name_snapshot?: string
          provider?: string
          provider_ref?: string | null
          recorded_by?: string | null
          reference?: string | null
          refund_of?: string | null
          state?: Database["public"]["Enums"]["payment_state"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_refund_of_fkey"
            columns: ["refund_of"]
            isOneToOne: false
            referencedRelation: "member_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
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
      member_subscriptions: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          gym_id: string
          id: string
          member_id: string
          period: Database["public"]["Enums"]["billing_period"]
          plan_id: string
          plan_name_snapshot: string
          started_on: string
          state: Database["public"]["Enums"]["subscription_state"]
          superseded_by: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          gym_id: string
          id?: string
          member_id: string
          period: Database["public"]["Enums"]["billing_period"]
          plan_id: string
          plan_name_snapshot: string
          started_on: string
          state?: Database["public"]["Enums"]["subscription_state"]
          superseded_by?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          gym_id?: string
          id?: string
          member_id?: string
          period?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string
          plan_name_snapshot?: string
          started_on?: string
          state?: Database["public"]["Enums"]["subscription_state"]
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_training_profiles: {
        Row: {
          created_at: string
          days_per_week: number
          equipment: string[]
          experience: string
          goals: string
          gym_id: string
          limitations: string
          member_id: string
          session_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          days_per_week?: number
          equipment?: string[]
          experience?: string
          goals?: string
          gym_id: string
          limitations?: string
          member_id: string
          session_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          days_per_week?: number
          equipment?: string[]
          experience?: string
          goals?: string
          gym_id?: string
          limitations?: string
          member_id?: string
          session_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_training_profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_training_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plan_prices: {
        Row: {
          id: string
          is_enabled: boolean
          period: Database["public"]["Enums"]["billing_period"]
          plan_id: string
          price: number
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          period: Database["public"]["Enums"]["billing_period"]
          plan_id: string
          price: number
        }
        Update: {
          id?: string
          is_enabled?: boolean
          period?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          archived_at: string | null
          badge_color: string | null
          created_at: string
          description: string | null
          features: string[]
          gym_id: string
          hides_ads: boolean
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          badge_color?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          gym_id: string
          hides_ads?: boolean
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          badge_color?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          gym_id?: string
          hides_ads?: boolean
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
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
      payment_reminders: {
        Row: {
          channel: string
          due_on_snapshot: string
          gym_id: string
          id: number
          member_id: string
          note: string | null
          sent_at: string
          sent_by: string | null
          subscription_id: string | null
        }
        Insert: {
          channel: string
          due_on_snapshot: string
          gym_id: string
          id?: number
          member_id: string
          note?: string | null
          sent_at?: string
          sent_by?: string | null
          subscription_id?: string | null
        }
        Update: {
          channel?: string
          due_on_snapshot?: string
          gym_id?: string
          id?: number
          member_id?: string
          note?: string | null
          sent_at?: string
          sent_by?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
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
          member_id: string | null
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
          member_id?: string | null
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
          member_id?: string | null
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
      ad_record_event: {
        Args: { _ad_id: string; _event: string }
        Returns: undefined
      }
      ad_serve: {
        Args: {
          _limit?: number
          _placement: Database["public"]["Enums"]["ad_placement"]
        }
        Returns: {
          advertiser_name: string
          body: string
          cta_label: string
          cta_url: string
          headline: string
          id: string
          image_path: string
          is_platform: boolean
        }[]
      }
      attendance_buckets: {
        Args: { _end: string; _gym_id: string; _start: string }
        Returns: {
          cnt: number
          day: string
          hour: number
          member_id: string
        }[]
      }
      cancel_member_subscription: {
        Args: { _reason: string; _subscription_id: string }
        Returns: Json
      }
      current_gym_id: { Args: never; Returns: string }
      expire_lapsed_subscriptions: { Args: never; Returns: number }
      gym_ad_daily: {
        Args: { _days?: number }
        Returns: {
          clicks: number
          day: string
          impressions: number
        }[]
      }
      gym_ad_report: {
        Args: { _days?: number }
        Returns: {
          ad_id: string
          advertiser_name: string
          clicks: number
          ctr: number
          ends_on: string
          headline: string
          impressions: number
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_on: string
          status: Database["public"]["Enums"]["ad_status"]
        }[]
      }
      gym_billing_settings_ensure: {
        Args: never
        Returns: {
          admin_digest_enabled: boolean
          auto_remind_members: boolean
          daily_summary_enabled: boolean
          daily_summary_hour: number
          grace_days: number
          gym_id: string
          reminder_lead_days: number
          reminder_template: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gym_billing_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gym_daily_activity: {
        Args: { _day: string; _gym_id: string }
        Returns: Json
      }
      gym_dues: {
        Args: { _bucket?: string }
        Returns: {
          amount_due: number
          bucket: string
          currency: string
          days_to_due: number
          display_name: string
          email: string
          ends_on: string
          in_grace: boolean
          last_payment_on: string
          last_reminded_at: string
          member_id: string
          period: Database["public"]["Enums"]["billing_period"]
          phone: string
          plan_id: string
          plan_name: string
          reminder_count: number
          subscription_id: string
        }[]
      }
      gym_dues_summary: { Args: never; Returns: Json }
      gym_revenue_report: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      gym_today: { Args: { _gym_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gym_staff_user: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_trainer_of: { Args: { _member_id: string }; Returns: boolean }
      is_valid_gym_slug: { Args: { _slug: string }; Returns: boolean }
      log_payment_reminder: {
        Args: {
          _channel: string
          _member_id: string
          _note?: string
          _subscription_id: string
        }
        Returns: undefined
      }
      my_gym_enabled: { Args: never; Returns: boolean }
      period_months: {
        Args: { _p: Database["public"]["Enums"]["billing_period"] }
        Returns: number
      }
      platform_activity_trend: {
        Args: { _days?: number }
        Returns: {
          active_members: number
          checkins: number
          day: string
          workouts: number
        }[]
      }
      platform_ad_report: { Args: { _days?: number }; Returns: Json }
      platform_ads_for_gym: {
        Args: never
        Returns: {
          advertiser_name: string
          blocked: boolean
          body: string
          cta_label: string
          cta_url: string
          ends_on: string
          headline: string
          id: string
          image_path: string
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_on: string
        }[]
      }
      platform_audit_ad: {
        Args: { _action: string; _ad_id: string }
        Returns: undefined
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
      platform_create_gym: {
        Args: {
          _currency?: string
          _internal_note?: string
          _name: string
          _owner_email?: string
          _primary_color?: string
          _slug: string
          _subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          _support_email?: string
          _support_phone?: string
          _timezone?: string
        }
        Returns: string
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
      platform_mark_owner_invited: {
        Args: { _email: string; _gym_id: string }
        Returns: undefined
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
      platform_set_gym_ad_note: {
        Args: { _gym_id: string; _note: string }
        Returns: undefined
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
      platform_slug_available: { Args: { _slug: string }; Returns: boolean }
      preview_member_payment: {
        Args: {
          _member_id: string
          _period: Database["public"]["Enums"]["billing_period"]
          _plan_id: string
          _starts_on?: string
          _supersede?: boolean
        }
        Returns: Json
      }
      record_member_payment: {
        Args: {
          _amount?: number
          _member_id: string
          _method?: Database["public"]["Enums"]["payment_method"]
          _note?: string
          _paid_on?: string
          _period: Database["public"]["Enums"]["billing_period"]
          _plan_id: string
          _reference?: string
          _starts_on?: string
          _supersede?: boolean
        }
        Returns: Json
      }
      refund_member_payment: {
        Args: { _note: string; _payment_id: string }
        Returns: Json
      }
      resolve_payment_window: {
        Args: {
          _member_id: string
          _period: Database["public"]["Enums"]["billing_period"]
          _plan_id: string
          _starts_on?: string
        }
        Returns: {
          covers_from: string
          covers_to: string
          days_lapsed: number
          is_lapsed_restart: boolean
          is_renewal: boolean
          other_plan_name: string
          other_plan_sub: string
          previous_ends_on: string
          same_plan_sub: string
        }[]
      }
      sync_member_membership: {
        Args: { _member_id: string }
        Returns: undefined
      }
      touch_last_sign_in: { Args: never; Returns: undefined }
      verify_join_code: {
        Args: { _code: string; _slug: string }
        Returns: boolean
      }
    }
    Enums: {
      ad_placement: "home_feed" | "workout_complete" | "checkin_success"
      ad_status: "draft" | "active" | "paused" | "archived"
      app_role: "admin" | "trainer" | "member"
      billing_period: "monthly" | "quarterly" | "half_yearly" | "annual"
      gym_payment_status:
        | "trialing"
        | "paid"
        | "pending"
        | "overdue"
        | "failed"
        | "cancelled"
      payment_method:
        | "cash"
        | "upi"
        | "card"
        | "bank_transfer"
        | "cheque"
        | "other"
      payment_state: "recorded" | "refunded"
      plan_status: "active" | "archived"
      subscription_plan: "starter" | "growth" | "pro" | "chain"
      subscription_state: "active" | "expired" | "cancelled" | "superseded"
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
      ad_placement: ["home_feed", "workout_complete", "checkin_success"],
      ad_status: ["draft", "active", "paused", "archived"],
      app_role: ["admin", "trainer", "member"],
      billing_period: ["monthly", "quarterly", "half_yearly", "annual"],
      gym_payment_status: [
        "trialing",
        "paid",
        "pending",
        "overdue",
        "failed",
        "cancelled",
      ],
      payment_method: [
        "cash",
        "upi",
        "card",
        "bank_transfer",
        "cheque",
        "other",
      ],
      payment_state: ["recorded", "refunded"],
      plan_status: ["active", "archived"],
      subscription_plan: ["starter", "growth", "pro", "chain"],
      subscription_state: ["active", "expired", "cancelled", "superseded"],
    },
  },
} as const
