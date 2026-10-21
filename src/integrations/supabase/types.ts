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
      applications: {
        Row: {
          answers: Json
          attendance: string | null
          certificate_url: string | null
          completed_at: string | null
          created_at: string
          hours_logged: number
          id: string
          message: string | null
          opportunity_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          answers?: Json
          attendance?: string | null
          certificate_url?: string | null
          completed_at?: string | null
          created_at?: string
          hours_logged?: number
          id?: string
          message?: string | null
          opportunity_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          answers?: Json
          attendance?: string | null
          certificate_url?: string | null
          completed_at?: string | null
          created_at?: string
          hours_logged?: number
          id?: string
          message?: string | null
          opportunity_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          tier: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          tier?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          tier?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          code: string
          hours: number | null
          id: string
          issued_at: string
          opportunity_id: string
          volunteer_id: string
        }
        Insert: {
          code?: string
          hours?: number | null
          id?: string
          issued_at?: string
          opportunity_id: string
          volunteer_id: string
        }
        Update: {
          code?: string
          hours?: number | null
          id?: string
          issued_at?: string
          opportunity_id?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_metrics: {
        Row: {
          created_at: string
          id: string
          metric_key: string
          opportunity_id: string
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_key: string
          opportunity_id: string
          unit?: string | null
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_key?: string
          opportunity_id?: string
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "impact_metrics_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      ngos: {
        Row: {
          address: string | null
          causes: string[]
          city: string | null
          contact_person: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          mission: string | null
          name: string
          owner_id: string
          phone: string | null
          postal_code: string | null
          registration_number: string | null
          slug: string | null
          social_links: Json
          state: string | null
          status: Database["public"]["Enums"]["ngo_status"]
          updated_at: string
          verification_notes: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          causes?: string[]
          city?: string | null
          contact_person?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name: string
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          registration_number?: string | null
          slug?: string | null
          social_links?: Json
          state?: string | null
          status?: Database["public"]["Enums"]["ngo_status"]
          updated_at?: string
          verification_notes?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          causes?: string[]
          city?: string | null
          contact_person?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          registration_number?: string | null
          slug?: string | null
          social_links?: Json
          state?: string | null
          status?: Database["public"]["Enums"]["ngo_status"]
          updated_at?: string
          verification_notes?: string | null
          website?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          address: string | null
          application_deadline: string | null
          benefits: string[] | null
          category: Database["public"]["Enums"]["opportunity_category"]
          city: string | null
          contact_email: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          custom_questions: Json
          description: string
          duration: string | null
          ends_at: string | null
          hours_estimate: number
          id: string
          is_paid: boolean
          location_mode: Database["public"]["Enums"]["location_mode"]
          min_age: number | null
          ngo_id: string
          provides_certificate: boolean
          requirements: string | null
          responsibilities: string | null
          skills_required: string[] | null
          slots: number
          starts_at: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          stipend: string | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          application_deadline?: string | null
          benefits?: string[] | null
          category: Database["public"]["Enums"]["opportunity_category"]
          city?: string | null
          contact_email?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          custom_questions?: Json
          description: string
          duration?: string | null
          ends_at?: string | null
          hours_estimate?: number
          id?: string
          is_paid?: boolean
          location_mode?: Database["public"]["Enums"]["location_mode"]
          min_age?: number | null
          ngo_id: string
          provides_certificate?: boolean
          requirements?: string | null
          responsibilities?: string | null
          skills_required?: string[] | null
          slots?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          stipend?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          application_deadline?: string | null
          benefits?: string[] | null
          category?: Database["public"]["Enums"]["opportunity_category"]
          city?: string | null
          contact_email?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          custom_questions?: Json
          description?: string
          duration?: string | null
          ends_at?: string | null
          hours_estimate?: number
          id?: string
          is_paid?: boolean
          location_mode?: Database["public"]["Enums"]["location_mode"]
          min_age?: number | null
          ngo_id?: string
          provides_certificate?: boolean
          requirements?: string | null
          responsibilities?: string | null
          skills_required?: string[] | null
          slots?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          stipend?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_views: {
        Row: {
          id: string
          opportunity_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_views_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          education: string | null
          experience: string | null
          first_name: string | null
          full_name: string | null
          id: string
          interests: string[] | null
          languages: string[] | null
          last_name: string | null
          occupation_status: string | null
          organization: string | null
          phone: string | null
          skills: string[] | null
          state: string | null
          updated_at: string
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          education?: string | null
          experience?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          interests?: string[] | null
          languages?: string[] | null
          last_name?: string | null
          occupation_status?: string | null
          organization?: string | null
          phone?: string | null
          skills?: string[] | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          education?: string | null
          experience?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          interests?: string[] | null
          languages?: string[] | null
          last_name?: string | null
          occupation_status?: string | null
          organization?: string | null
          phone?: string | null
          skills?: string[] | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          reporter_id: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reporter_id?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ngo_id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ngo_id: string
          rating: number
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ngo_id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_opportunities: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volunteer_stats: {
        Row: {
          completed_count: number
          created_at: string
          impact_score: number
          last_activity_at: string | null
          level: number
          streak_days: number
          total_hours: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          completed_count?: number
          created_at?: string
          impact_score?: number
          last_activity_at?: string | null
          level?: number
          streak_days?: number
          total_hours?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          completed_count?: number
          created_at?: string
          impact_score?: number
          last_activity_at?: string | null
          level?: number
          streak_days?: number
          total_hours?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      application_availability: {
        Args: { _opportunity_id: string }
        Returns: {
          remaining: number
        }[]
      }
      award_completion: {
        Args: { _application_id: string }
        Returns: undefined
      }
      can_manage_application: {
        Args: { _app_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_application_file: {
        Args: { _app_id: string; _user_id: string }
        Returns: boolean
      }
      get_applicant_emails: {
        Args: { _opp_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_profiles_private: {
        Args: { _ids: string[] }
        Returns: {
          experience: string
          id: string
          occupation_status: string
          organization: string
          phone: string
        }[]
      }
      grant_super_admin_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ngo_owner: {
        Args: { _ngo_id: string; _user_id: string }
        Returns: boolean
      }
      is_opp_ngo_owner: {
        Args: { _opp_id: string; _user_id: string }
        Returns: boolean
      }
      list_my_reports: {
        Args: never
        Returns: {
          created_at: string
          details: string
          id: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subject: string
        }[]
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_super_admins: {
        Args: never
        Returns: {
          email: string
          granted_at: string
          user_id: string
        }[]
      }
      review_report: {
        Args: { _id: string; _resolution: string; _status: string }
        Returns: undefined
      }
      revoke_super_admin: { Args: { _user_id: string }; Returns: undefined }
      set_my_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      submit_report: {
        Args: { _details: string; _subject: string }
        Returns: string
      }
      verify_certificate: {
        Args: { _code: string }
        Returns: {
          code: string
          hours: number
          issued_at: string
          ngo_name: string
          opportunity_title: string
          volunteer_name: string
        }[]
      }
    }
    Enums: {
      app_role: "volunteer" | "ngo_admin" | "super_admin"
      application_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "completed"
      location_mode: "onsite" | "remote" | "hybrid"
      ngo_status: "pending" | "verified" | "rejected"
      opportunity_category:
        | "education"
        | "environment"
        | "animal_welfare"
        | "healthcare"
        | "community_development"
        | "disaster_relief"
        | "children"
        | "elderly_care"
        | "technology"
        | "human_rights"
      opportunity_status: "draft" | "published" | "closed"
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
      app_role: ["volunteer", "ngo_admin", "super_admin"],
      application_status: [
        "pending",
        "accepted",
        "rejected",
        "withdrawn",
        "completed",
      ],
      location_mode: ["onsite", "remote", "hybrid"],
      ngo_status: ["pending", "verified", "rejected"],
      opportunity_category: [
        "education",
        "environment",
        "animal_welfare",
        "healthcare",
        "community_development",
        "disaster_relief",
        "children",
        "elderly_care",
        "technology",
        "human_rights",
      ],
      opportunity_status: ["draft", "published", "closed"],
    },
  },
} as const
