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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          code: string | null
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          region: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agency_config: {
        Row: {
          agency_id: string
          created_at: string
          requires_reference: boolean
        }
        Insert: {
          agency_id: string
          created_at?: string
          requires_reference?: boolean
        }
        Update: {
          agency_id?: string
          created_at?: string
          requires_reference?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agency_config_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistants: {
        Row: {
          context: string | null
          conversation: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          last_activity: string | null
          session_id: string
        }
        Insert: {
          context?: string | null
          conversation: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          session_id: string
        }
        Update: {
          context?: string | null
          conversation?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          session_id?: string
        }
        Relationships: []
      }
      ai_views: {
        Row: {
          context: string
          created_at: string
          filters: Json
          id: string
          layout: string
          layout_options: Json | null
          metadata: Json | null
          owner_id: string | null
          signature: string
          sorts: Json
          title: string
          updated_at: string
          visible_properties: Json
        }
        Insert: {
          context: string
          created_at?: string
          filters?: Json
          id?: string
          layout: string
          layout_options?: Json | null
          metadata?: Json | null
          owner_id?: string | null
          signature: string
          sorts?: Json
          title: string
          updated_at?: string
          visible_properties?: Json
        }
        Update: {
          context?: string
          created_at?: string
          filters?: Json
          id?: string
          layout?: string
          layout_options?: Json | null
          metadata?: Json | null
          owner_id?: string | null
          signature?: string
          sorts?: Json
          title?: string
          updated_at?: string
          visible_properties?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_views_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_views_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      artisan_absences: {
        Row: {
          artisan_id: string | null
          created_at: string | null
          end_date: string
          id: string
          is_confirmed: boolean | null
          reason: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          artisan_id?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          is_confirmed?: boolean | null
          reason?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          is_confirmed?: boolean | null
          reason?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_absences_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_absences_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_attachments: {
        Row: {
          artisan_id: string | null
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          created_by_code: string | null
          created_by_color: string | null
          created_by_display: string | null
          derived_sizes: Json | null
          file_size: number | null
          filename: string | null
          id: string
          kind: string
          mime_preferred: string | null
          mime_type: string | null
          url: string
        }
        Insert: {
          artisan_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_code?: string | null
          created_by_color?: string | null
          created_by_display?: string | null
          derived_sizes?: Json | null
          file_size?: number | null
          filename?: string | null
          id?: string
          kind: string
          mime_preferred?: string | null
          mime_type?: string | null
          url: string
        }
        Update: {
          artisan_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_code?: string | null
          created_by_color?: string | null
          created_by_display?: string | null
          derived_sizes?: Json | null
          file_size?: number | null
          filename?: string | null
          id?: string
          kind?: string
          mime_preferred?: string | null
          mime_type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "artisan_attachments_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_attachments_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      artisan_metiers: {
        Row: {
          artisan_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          metier_id: string | null
        }
        Insert: {
          artisan_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          metier_id?: string | null
        }
        Update: {
          artisan_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          metier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_metiers_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_metiers_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_metiers_metier_id_fkey"
            columns: ["metier_id"]
            isOneToOne: false
            referencedRelation: "metiers"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_portal_tokens: {
        Row: {
          artisan_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          token: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          token: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "artisan_portal_tokens_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_portal_tokens_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_report_photos: {
        Row: {
          artisan_id: string
          comment: string | null
          created_at: string | null
          filename: string
          id: string
          intervention_id: string
          mime_type: string | null
          portal_photo_id: string | null
          report_id: string | null
          size_bytes: number | null
          storage_path: string
          synced_from_portal: boolean | null
        }
        Insert: {
          artisan_id: string
          comment?: string | null
          created_at?: string | null
          filename: string
          id?: string
          intervention_id: string
          mime_type?: string | null
          portal_photo_id?: string | null
          report_id?: string | null
          size_bytes?: number | null
          storage_path: string
          synced_from_portal?: boolean | null
        }
        Update: {
          artisan_id?: string
          comment?: string | null
          created_at?: string | null
          filename?: string
          id?: string
          intervention_id?: string
          mime_type?: string | null
          portal_photo_id?: string | null
          report_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          synced_from_portal?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_report_photos_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_report_photos_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_report_photos_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_report_photos_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "artisan_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_reports: {
        Row: {
          artisan_id: string
          content: string
          created_at: string | null
          id: string
          intervention_id: string
          metadata: Json | null
          photo_ids: string[] | null
          portal_report_id: string | null
          status: string | null
          submitted_at: string | null
          synced_from_portal: boolean | null
          updated_at: string | null
        }
        Insert: {
          artisan_id: string
          content: string
          created_at?: string | null
          id?: string
          intervention_id: string
          metadata?: Json | null
          photo_ids?: string[] | null
          portal_report_id?: string | null
          status?: string | null
          submitted_at?: string | null
          synced_from_portal?: boolean | null
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string
          content?: string
          created_at?: string | null
          id?: string
          intervention_id?: string
          metadata?: Json | null
          photo_ids?: string[] | null
          portal_report_id?: string | null
          status?: string | null
          submitted_at?: string | null
          synced_from_portal?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      artisan_status_history: {
        Row: {
          artisan_id: string
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          completed_interventions_count: number | null
          created_at: string
          id: string
          new_status_id: string
          old_status_id: string | null
        }
        Insert: {
          artisan_id: string
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          completed_interventions_count?: number | null
          created_at?: string
          id?: string
          new_status_id: string
          old_status_id?: string | null
        }
        Update: {
          artisan_id?: string
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          completed_interventions_count?: number | null
          created_at?: string
          id?: string
          new_status_id?: string
          old_status_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_status_history_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_status_history_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "artisan_status_history_new_status_id_fkey"
            columns: ["new_status_id"]
            isOneToOne: false
            referencedRelation: "artisan_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_status_history_old_status_id_fkey"
            columns: ["old_status_id"]
            isOneToOne: false
            referencedRelation: "artisan_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_statuses: {
        Row: {
          code: string
          color: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          code: string
          color?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          color?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      artisan_zones: {
        Row: {
          artisan_id: string | null
          created_at: string | null
          id: string
          zone_id: string | null
        }
        Insert: {
          artisan_id?: string | null
          created_at?: string | null
          id?: string
          zone_id?: string | null
        }
        Update: {
          artisan_id?: string | null
          created_at?: string | null
          id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_zones_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_zones_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      artisans: {
        Row: {
          adresse_intervention: string | null
          adresse_siege_social: string | null
          code_postal_intervention: string | null
          code_postal_siege_social: string | null
          created_at: string | null
          date_ajout: string | null
          departement: number | null
          email: string | null
          gestionnaire_id: string | null
          iban: string | null
          id: string
          intervention_latitude: number | null
          intervention_longitude: number | null
          is_active: boolean | null
          nom: string | null
          numero_associe: string | null
          plain_nom: string | null
          prenom: string | null
          raison_sociale: string | null
          siret: string | null
          statut_dossier: string | null
          statut_id: string | null
          statut_juridique: string | null
          suivi_relances_docs: string | null
          telephone: string | null
          telephone2: string | null
          updated_at: string | null
          ville_intervention: string | null
          ville_siege_social: string | null
        }
        Insert: {
          adresse_intervention?: string | null
          adresse_siege_social?: string | null
          code_postal_intervention?: string | null
          code_postal_siege_social?: string | null
          created_at?: string | null
          date_ajout?: string | null
          departement?: number | null
          email?: string | null
          gestionnaire_id?: string | null
          iban?: string | null
          id?: string
          intervention_latitude?: number | null
          intervention_longitude?: number | null
          is_active?: boolean | null
          nom?: string | null
          numero_associe?: string | null
          plain_nom?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          siret?: string | null
          statut_dossier?: string | null
          statut_id?: string | null
          statut_juridique?: string | null
          suivi_relances_docs?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville_intervention?: string | null
          ville_siege_social?: string | null
        }
        Update: {
          adresse_intervention?: string | null
          adresse_siege_social?: string | null
          code_postal_intervention?: string | null
          code_postal_siege_social?: string | null
          created_at?: string | null
          date_ajout?: string | null
          departement?: number | null
          email?: string | null
          gestionnaire_id?: string | null
          iban?: string | null
          id?: string
          intervention_latitude?: number | null
          intervention_longitude?: number | null
          is_active?: boolean | null
          nom?: string | null
          numero_associe?: string | null
          plain_nom?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          siret?: string | null
          statut_dossier?: string | null
          statut_id?: string | null
          statut_juridique?: string | null
          suivi_relances_docs?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville_intervention?: string | null
          ville_siege_social?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisans_gestionnaire_id_fkey"
            columns: ["gestionnaire_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisans_gestionnaire_id_fkey"
            columns: ["gestionnaire_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "artisans_statut_id_fkey"
            columns: ["statut_id"]
            isOneToOne: false
            referencedRelation: "artisan_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_providers: {
        Row: {
          created_at: string | null
          id: string
          provider: string
          provider_user_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          provider: string
          provider_user_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          provider?: string
          provider_user_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      auth_user_mapping: {
        Row: {
          auth_user_id: string
          created_at: string | null
          id: string
          public_user_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string | null
          id?: string
          public_user_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string | null
          id?: string
          public_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_user_mapping_public_user_id_fkey"
            columns: ["public_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_user_mapping_public_user_id_fkey"
            columns: ["public_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      billing_state: {
        Row: {
          cadence: string | null
          created_at: string | null
          current_plan_id: string | null
          id: string
          requests_remaining: number | null
          status: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cadence?: string | null
          created_at?: string | null
          current_plan_id?: string | null
          id?: string
          requests_remaining?: number | null
          status?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cadence?: string | null
          created_at?: string | null
          current_plan_id?: string | null
          id?: string
          requests_remaining?: number | null
          status?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string | null
          content: string
          cost_cents: number | null
          created_at: string | null
          id: string
          role: string
          session_id: string | null
          tokens: number | null
        }
        Insert: {
          author_id?: string | null
          content: string
          cost_cents?: number | null
          created_at?: string | null
          id?: string
          role: string
          session_id?: string | null
          tokens?: number | null
        }
        Update: {
          author_id?: string | null
          content?: string
          cost_cents?: number | null
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string | null
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          model_tier: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model_tier?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model_tier?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          comment_type: string | null
          content: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_internal: boolean | null
          reason_type: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          comment_type?: string | null
          content: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_internal?: boolean | null
          reason_type?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          comment_type?: string | null
          content?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_internal?: boolean | null
          reason_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string | null
          id: string
          joined_at: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_private: boolean | null
          metadata: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_private?: boolean | null
          metadata?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_private?: boolean | null
          metadata?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_logs: {
        Row: {
          artisan_id: string | null
          attachments_count: number | null
          created_at: string | null
          email_type: string | null
          error_message: string | null
          id: string
          intervention_id: string | null
          message_html: string | null
          recipient_email: string
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          artisan_id?: string | null
          attachments_count?: number | null
          created_at?: string | null
          email_type?: string | null
          error_message?: string | null
          id?: string
          intervention_id?: string | null
          message_html?: string | null
          recipient_email: string
          sent_at?: string | null
          sent_by?: string | null
          status: string
          subject: string
        }
        Update: {
          artisan_id?: string | null
          attachments_count?: number | null
          created_at?: string | null
          email_type?: string | null
          error_message?: string | null
          id?: string
          intervention_id?: string | null
          message_html?: string | null
          recipient_email?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gestionnaire_targets: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          margin_target: number | null
          performance_target: number | null
          period_type: Database["public"]["Enums"]["target_period_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          margin_target?: number | null
          performance_target?: number | null
          period_type: Database["public"]["Enums"]["target_period_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          margin_target?: number | null
          performance_target?: number | null
          period_type?: Database["public"]["Enums"]["target_period_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestionnaire_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestionnaire_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gestionnaire_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestionnaire_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      intervention_artisans: {
        Row: {
          artisan_id: string | null
          assigned_at: string | null
          created_at: string | null
          id: string
          intervention_id: string | null
          is_primary: boolean | null
          role: string | null
        }
        Insert: {
          artisan_id?: string | null
          assigned_at?: string | null
          created_at?: string | null
          id?: string
          intervention_id?: string | null
          is_primary?: boolean | null
          role?: string | null
        }
        Update: {
          artisan_id?: string | null
          assigned_at?: string | null
          created_at?: string | null
          id?: string
          intervention_id?: string | null
          is_primary?: boolean | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_artisans_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_artisans_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_artisans_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_artisans_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_attachments: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_code: string | null
          created_by_color: string | null
          created_by_display: string | null
          file_size: number | null
          filename: string | null
          id: string
          intervention_id: string | null
          kind: string
          metadata: Json | null
          mime_type: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_code?: string | null
          created_by_color?: string | null
          created_by_display?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          intervention_id?: string | null
          kind: string
          metadata?: Json | null
          mime_type?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_code?: string | null
          created_by_color?: string | null
          created_by_display?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          intervention_id?: string | null
          kind?: string
          metadata?: Json | null
          mime_type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intervention_attachments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_attachments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_audit_log: {
        Row: {
          action_type: string
          actor_code: string | null
          actor_color: string | null
          actor_display: string | null
          actor_user_id: string | null
          changed_fields: string[] | null
          created_at: string
          id: string
          intervention_id: string
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
          request_id: string | null
          source: string | null
          status_transition_id: string | null
          transaction_id: number | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_code?: string | null
          actor_color?: string | null
          actor_display?: string | null
          actor_user_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          intervention_id: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          request_id?: string | null
          source?: string | null
          status_transition_id?: string | null
          transaction_id?: number | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_code?: string | null
          actor_color?: string | null
          actor_display?: string | null
          actor_user_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          intervention_id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          request_id?: string | null
          source?: string | null
          status_transition_id?: string | null
          transaction_id?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intervention_audit_log_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_audit_log_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_audit_log_status_transition_id_fkey"
            columns: ["status_transition_id"]
            isOneToOne: false
            referencedRelation: "intervention_status_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_compta_checks: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          id: string
          intervention_id: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          intervention_id: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          id?: string
          intervention_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_compta_checks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_compta_checks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_costs: {
        Row: {
          amount: number
          artisan_order: number | null
          cost_type: string
          created_at: string | null
          currency: string | null
          id: string
          intervention_id: string | null
          label: string | null
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          artisan_order?: number | null
          cost_type: string
          created_at?: string | null
          currency?: string | null
          id?: string
          intervention_id?: string | null
          label?: string | null
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          artisan_order?: number | null
          cost_type?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          intervention_id?: string | null
          label?: string | null
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_costs_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_costs_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_costs_cache: {
        Row: {
          intervention_id: string
          total_ca: number
          total_marge: number
          total_materiel: number
          total_sst: number
          updated_at: string | null
        }
        Insert: {
          intervention_id: string
          total_ca?: number
          total_marge?: number
          total_materiel?: number
          total_sst?: number
          updated_at?: string | null
        }
        Update: {
          intervention_id?: string
          total_ca?: number
          total_marge?: number
          total_materiel?: number
          total_sst?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_costs_cache_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_costs_cache_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          intervention_id: string | null
          is_received: boolean | null
          payment_date: string | null
          payment_type: string
          reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          intervention_id?: string | null
          is_received?: boolean | null
          payment_date?: string | null
          payment_type: string
          reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          intervention_id?: string | null
          is_received?: boolean | null
          payment_date?: string | null
          payment_type?: string
          reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_payments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_payments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_reminders: {
        Row: {
          created_at: string | null
          due_date: string | null
          id: string
          intervention_id: string
          is_active: boolean | null
          is_completed: boolean | null
          mentioned_user_ids: string[] | null
          note: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          id?: string
          intervention_id: string
          is_active?: boolean | null
          is_completed?: boolean | null
          mentioned_user_ids?: string[] | null
          note?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
          id?: string
          intervention_id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          mentioned_user_ids?: string[] | null
          note?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_reminders_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_reminders_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      intervention_status_transitions: {
        Row: {
          changed_by_user_id: string | null
          created_at: string
          from_status_code: string | null
          from_status_id: string | null
          id: string
          intervention_id: string
          metadata: Json | null
          source: string | null
          to_status_code: string | null
          to_status_id: string
          transition_date: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string
          from_status_code?: string | null
          from_status_id?: string | null
          id?: string
          intervention_id: string
          metadata?: Json | null
          source?: string | null
          to_status_code?: string | null
          to_status_id: string
          transition_date?: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string
          from_status_code?: string | null
          from_status_id?: string | null
          id?: string
          intervention_id?: string
          metadata?: Json | null
          source?: string | null
          to_status_code?: string | null
          to_status_id?: string
          transition_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_status_transitions_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_status_transitions_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "intervention_status_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "intervention_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_status_transitions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_status_transitions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_status_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "intervention_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_statuses: {
        Row: {
          code: string
          color: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          code: string
          color?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          color?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      interventions: {
        Row: {
          adresse: string | null
          adresse_complete: string | null
          agence_id: string | null
          apartment_number: string | null
          assigned_user_id: string | null
          code_postal: string | null
          commentaire_agent: string | null
          consigne_intervention: string | null
          consigne_second_artisan: string | null
          contexte_intervention: string | null
          created_at: string | null
          created_by: string | null
          date: string
          date_prevue: string | null
          date_termine: string | null
          due_date: string | null
          floor: string | null
          has_portal_report: boolean | null
          id: string
          id_inter: string | null
          is_active: boolean | null
          is_vacant: boolean | null
          key_code: string | null
          latitude: number | null
          longitude: number | null
          metier_id: string | null
          metier_second_artisan_id: string | null
          owner_id: string | null
          reference_agence: string | null
          sous_statut_bg_color: string | null
          sous_statut_text: string | null
          sous_statut_text_color: string | null
          statut_id: string | null
          tenant_id: string | null
          updated_at: string | null
          updated_by: string | null
          vacant_housing_instructions: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_complete?: string | null
          agence_id?: string | null
          apartment_number?: string | null
          assigned_user_id?: string | null
          code_postal?: string | null
          commentaire_agent?: string | null
          consigne_intervention?: string | null
          consigne_second_artisan?: string | null
          contexte_intervention?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          date_prevue?: string | null
          date_termine?: string | null
          due_date?: string | null
          floor?: string | null
          has_portal_report?: boolean | null
          id?: string
          id_inter?: string | null
          is_active?: boolean | null
          is_vacant?: boolean | null
          key_code?: string | null
          latitude?: number | null
          longitude?: number | null
          metier_id?: string | null
          metier_second_artisan_id?: string | null
          owner_id?: string | null
          reference_agence?: string | null
          sous_statut_bg_color?: string | null
          sous_statut_text?: string | null
          sous_statut_text_color?: string | null
          statut_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vacant_housing_instructions?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_complete?: string | null
          agence_id?: string | null
          apartment_number?: string | null
          assigned_user_id?: string | null
          code_postal?: string | null
          commentaire_agent?: string | null
          consigne_intervention?: string | null
          consigne_second_artisan?: string | null
          contexte_intervention?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          date_prevue?: string | null
          date_termine?: string | null
          due_date?: string | null
          floor?: string | null
          has_portal_report?: boolean | null
          id?: string
          id_inter?: string | null
          is_active?: boolean | null
          is_vacant?: boolean | null
          key_code?: string | null
          latitude?: number | null
          longitude?: number | null
          metier_id?: string | null
          metier_second_artisan_id?: string | null
          owner_id?: string | null
          reference_agence?: string | null
          sous_statut_bg_color?: string | null
          sous_statut_text?: string | null
          sous_statut_text_color?: string | null
          statut_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vacant_housing_instructions?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_agence_id_fkey"
            columns: ["agence_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "interventions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "interventions_metier_id_fkey"
            columns: ["metier_id"]
            isOneToOne: false
            referencedRelation: "metiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_metier_second_artisan_id_fkey"
            columns: ["metier_second_artisan_id"]
            isOneToOne: false
            referencedRelation: "metiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_statut_id_fkey"
            columns: ["statut_id"]
            isOneToOne: false
            referencedRelation: "intervention_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lateness_email_config: {
        Row: {
          created_at: string | null
          email_password_encrypted: string
          email_smtp: string
          id: string
          is_enabled: boolean | null
          motivation_message: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          email_password_encrypted: string
          email_smtp: string
          id?: string
          is_enabled?: boolean | null
          motivation_message?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          email_password_encrypted?: string
          email_smtp?: string
          id?: string
          is_enabled?: boolean | null
          motivation_message?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lateness_email_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lateness_email_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          file_size: number | null
          filename: string | null
          id: string
          message_id: string | null
          mime_type: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string | null
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          payload: Json | null
          type: string | null
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          type?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      metiers: {
        Row: {
          code: string | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          label: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string | null
          id: string
          pack_id: string | null
          plan_id: string | null
          requests_credited: number | null
          status: string
          stripe_checkout_session_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string | null
          id?: string
          pack_id?: string | null
          plan_id?: string | null
          requests_credited?: number | null
          status: string
          stripe_checkout_session_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          pack_id?: string | null
          plan_id?: string | null
          requests_credited?: number | null
          status?: string
          stripe_checkout_session_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      owner: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string | null
          email: string | null
          external_ref: string | null
          id: string
          owner_firstname: string | null
          owner_lastname: string | null
          plain_nom_facturation: string | null
          telephone: string | null
          telephone2: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          external_ref?: string | null
          id?: string
          owner_firstname?: string | null
          owner_lastname?: string | null
          plain_nom_facturation?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          external_ref?: string | null
          id?: string
          owner_firstname?: string | null
          owner_lastname?: string | null
          plain_nom_facturation?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean | null
          last4: string | null
          stripe_payment_method_id: string
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id: string
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      plugin_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          plugin_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plugin_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plugin_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      podium_periods: {
        Row: {
          created_at: string
          id: string
          is_current: boolean | null
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean | null
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean | null
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string | null
          role_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      search_views_refresh_flags: {
        Row: {
          created_at: string | null
          id: string
          last_flag_set: string | null
          last_refresh: string | null
          needs_refresh: boolean | null
        }
        Insert: {
          created_at?: string | null
          id: string
          last_flag_set?: string | null
          last_refresh?: string | null
          needs_refresh?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_flag_set?: string | null
          last_refresh?: string | null
          needs_refresh?: boolean | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cadence: string | null
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_id: string | null
          status: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cadence?: string | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cadence?: string | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          changes: Json | null
          created_at: string | null
          entity_id: string
          entity_type: string
          error: string | null
          id: string
          operation: string | null
          success: boolean | null
        }
        Insert: {
          changes?: Json | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          error?: string | null
          id?: string
          operation?: string | null
          success?: boolean | null
        }
        Update: {
          changes?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error?: string | null
          id?: string
          operation?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          code: string
          color: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          code: string
          color?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          color?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          artisan_id: string | null
          assignee_id: string | null
          completed_at: string | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          due_date: string | null
          id: string
          intervention_id: string | null
          is_completed: boolean | null
          metadata: Json | null
          priority: number | null
          status_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          artisan_id?: string | null
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          intervention_id?: string | null
          is_completed?: boolean | null
          metadata?: Json | null
          priority?: number | null
          status_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string | null
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          intervention_id?: string | null
          is_completed?: boolean | null
          metadata?: Json | null
          priority?: number | null
          status_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string | null
          email: string | null
          external_ref: string | null
          firstname: string | null
          id: string
          lastname: string | null
          plain_nom_client: string | null
          telephone: string | null
          telephone2: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          external_ref?: string | null
          firstname?: string | null
          id?: string
          lastname?: string | null
          plain_nom_client?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          external_ref?: string | null
          firstname?: string | null
          id?: string
          lastname?: string | null
          plain_nom_client?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          chat_tier: string | null
          created_at: string | null
          delta: number
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          chat_tier?: string | null
          created_at?: string | null
          delta: number
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          chat_tier?: string | null
          created_at?: string | null
          delta?: number
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_page_permissions: {
        Row: {
          created_at: string | null
          has_access: boolean | null
          id: string
          page_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          has_access?: boolean | null
          id?: string
          page_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          has_access?: boolean | null
          id?: string
          page_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_page_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_page_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted: boolean
          granted_by: string | null
          id: string
          permission_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          speedometer_margin_average_show_percentage: boolean | null
          speedometer_margin_total_show_percentage: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          speedometer_margin_average_show_percentage?: boolean | null
          speedometer_margin_total_show_percentage?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          speedometer_margin_average_show_percentage?: boolean | null
          speedometer_margin_total_show_percentage?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          archived_at: string | null
          auth_user_id: string | null
          avatar_url: string | null
          code_gestionnaire: string | null
          color: string | null
          created_at: string | null
          email: string | null
          email_password_encrypted: string | null
          email_smtp: string | null
          email_smtp_enabled: boolean | null
          email_smtp_from_address: string | null
          email_smtp_from_name: string | null
          email_smtp_host: string | null
          email_smtp_password_encrypted: string | null
          email_smtp_port: number | null
          email_smtp_user: string | null
          firstname: string | null
          id: string
          last_activity_date: string | null
          last_lateness_date: string | null
          last_seen_at: string | null
          lastname: string | null
          lateness_count: number | null
          lateness_count_year: number | null
          lateness_email_sent_at: string | null
          lateness_notification_shown_at: string | null
          restored_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          token_version: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          code_gestionnaire?: string | null
          color?: string | null
          created_at?: string | null
          email?: string | null
          email_password_encrypted?: string | null
          email_smtp?: string | null
          email_smtp_enabled?: boolean | null
          email_smtp_from_address?: string | null
          email_smtp_from_name?: string | null
          email_smtp_host?: string | null
          email_smtp_password_encrypted?: string | null
          email_smtp_port?: number | null
          email_smtp_user?: string | null
          firstname?: string | null
          id?: string
          last_activity_date?: string | null
          last_lateness_date?: string | null
          last_seen_at?: string | null
          lastname?: string | null
          lateness_count?: number | null
          lateness_count_year?: number | null
          lateness_email_sent_at?: string | null
          lateness_notification_shown_at?: string | null
          restored_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          token_version?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          code_gestionnaire?: string | null
          color?: string | null
          created_at?: string | null
          email?: string | null
          email_password_encrypted?: string | null
          email_smtp?: string | null
          email_smtp_enabled?: boolean | null
          email_smtp_from_address?: string | null
          email_smtp_from_name?: string | null
          email_smtp_host?: string | null
          email_smtp_password_encrypted?: string | null
          email_smtp_port?: number | null
          email_smtp_user?: string | null
          firstname?: string | null
          id?: string
          last_activity_date?: string | null
          last_lateness_date?: string | null
          last_seen_at?: string | null
          lastname?: string | null
          lateness_count?: number | null
          lateness_count_year?: number | null
          lateness_email_sent_at?: string | null
          lateness_notification_shown_at?: string | null
          restored_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          token_version?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          region: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          region?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          region?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      artisans_search_mv: {
        Row: {
          active_interventions_count: number | null
          adresse_intervention: string | null
          adresse_siege_social: string | null
          code_postal_intervention: string | null
          code_postal_siege_social: string | null
          created_at: string | null
          date_ajout_formatted: string | null
          departement: number | null
          email: string | null
          gestionnaire_code: string | null
          gestionnaire_firstname: string | null
          gestionnaire_id: string | null
          gestionnaire_lastname: string | null
          gestionnaire_username: string | null
          id: string | null
          is_active: boolean | null
          metiers_codes: string | null
          metiers_descriptions: string | null
          metiers_labels: string | null
          nom: string | null
          numero_associe: string | null
          plain_nom: string | null
          prenom: string | null
          raison_sociale: string | null
          search_vector: unknown
          siret: string | null
          statut_code: string | null
          statut_color: string | null
          statut_dossier: string | null
          statut_id: string | null
          statut_juridique: string | null
          statut_label: string | null
          suivi_relances_docs: string | null
          telephone: string | null
          telephone2: string | null
          updated_at: string | null
          ville_intervention: string | null
          ville_siege_social: string | null
          zones_codes: string | null
          zones_labels: string | null
          zones_regions: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisans_gestionnaire_id_fkey"
            columns: ["gestionnaire_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisans_gestionnaire_id_fkey"
            columns: ["gestionnaire_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "artisans_statut_id_fkey"
            columns: ["statut_id"]
            isOneToOne: false
            referencedRelation: "artisan_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      global_search_mv: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          metadata: Json | null
          search_vector: unknown
          updated_at: string | null
        }
        Relationships: []
      }
      interventions_ca: {
        Row: {
          intervention_id: string | null
          total_ca: number | null
        }
        Insert: {
          intervention_id?: string | null
          total_ca?: number | null
        }
        Update: {
          intervention_id?: string | null
          total_ca?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_costs_cache_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_costs_cache_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: true
            referencedRelation: "interventions_search_mv"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions_search_mv: {
        Row: {
          adresse: string | null
          agence_code: string | null
          agence_id: string | null
          agence_label: string | null
          agence_region: string | null
          apartment_number: string | null
          artisan_adresse_intervention: string | null
          artisan_adresse_siege: string | null
          artisan_code_postal_intervention: string | null
          artisan_code_postal_siege: string | null
          artisan_date_ajout: string | null
          artisan_email: string | null
          artisan_nom: string | null
          artisan_numero_associe: string | null
          artisan_plain_nom: string | null
          artisan_prenom: string | null
          artisan_raison_sociale: string | null
          artisan_siret: string | null
          artisan_statut_dossier: string | null
          artisan_statut_juridique: string | null
          artisan_suivi_relances: string | null
          artisan_telephone: string | null
          artisan_telephone2: string | null
          artisan_ville_intervention: string | null
          artisan_ville_siege: string | null
          assigned_user_code: string | null
          assigned_user_firstname: string | null
          assigned_user_id: string | null
          assigned_user_lastname: string | null
          assigned_user_username: string | null
          code_postal: string | null
          commentaire_agent: string | null
          commentaires_aggreges: string | null
          consigne_intervention: string | null
          consigne_second_artisan: string | null
          contexte_intervention: string | null
          created_at: string | null
          date: string | null
          date_formatted: string | null
          date_prevue: string | null
          date_prevue_formatted: string | null
          date_termine_formatted: string | null
          due_date_formatted: string | null
          floor: string | null
          id: string | null
          id_inter: string | null
          is_active: boolean | null
          key_code: string | null
          metier_code: string | null
          metier_description: string | null
          metier_id: string | null
          metier_label: string | null
          owner_adresse: string | null
          owner_code_postal: string | null
          owner_email: string | null
          owner_firstname: string | null
          owner_lastname: string | null
          owner_telephone: string | null
          owner_telephone2: string | null
          owner_ville: string | null
          primary_artisan_id: string | null
          reference_agence: string | null
          search_vector: unknown
          statut_code: string | null
          statut_color: string | null
          statut_id: string | null
          statut_label: string | null
          tenant_adresse: string | null
          tenant_code_postal: string | null
          tenant_email: string | null
          tenant_firstname: string | null
          tenant_lastname: string | null
          tenant_telephone: string | null
          tenant_telephone2: string | null
          tenant_ville: string | null
          updated_at: string | null
          vacant_housing_instructions: string | null
          ville: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_artisans_artisan_id_fkey"
            columns: ["primary_artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_artisans_artisan_id_fkey"
            columns: ["primary_artisan_id"]
            isOneToOne: false
            referencedRelation: "artisans_search_mv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_agence_id_fkey"
            columns: ["agence_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_permissions_debug"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "interventions_metier_id_fkey"
            columns: ["metier_id"]
            isOneToOne: false
            referencedRelation: "metiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_statut_id_fkey"
            columns: ["statut_id"]
            isOneToOne: false
            referencedRelation: "intervention_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_permissions_debug: {
        Row: {
          email: string | null
          firstname: string | null
          lastname: string | null
          permissions: string[] | null
          role_name: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_artisan_dossier_status: {
        Args: { artisan_uuid: string }
        Returns: string
      }
      check_inactive_users: {
        Args: never
        Returns: {
          affected_user_ids: string[]
          users_set_offline: number
        }[]
      }
      create_automatic_status_transitions_on_creation: {
        Args: {
          p_changed_by_user_id?: string
          p_intervention_id: string
          p_metadata?: Json
          p_to_status_code: string
        }
        Returns: number
      }
      filter_interventions_ischeck: {
        Args: { p_include_check?: boolean; p_user_id?: string }
        Returns: {
          intervention_id: string
        }[]
      }
      generate_artisan_portal_token: {
        Args: { p_artisan_id: string; p_created_by?: string }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      get_actor_snapshot: {
        Args: { p_user_id: string }
        Returns: {
          actor_code: string
          actor_color: string
          actor_display: string
          actor_user_id: string
        }[]
      }
      get_admin_dashboard_stats: {
        Args: {
          p_accepte_status_code: string
          p_agence_id?: string
          p_att_acompte_status_code: string
          p_demande_status_code: string
          p_devis_status_code: string
          p_en_cours_status_code: string
          p_gestionnaire_id?: string
          p_metier_id?: string
          p_period_end: string
          p_period_start: string
          p_terminee_status_code: string
          p_valid_status_codes: string[]
        }
        Returns: Json
      }
      get_admin_dashboard_stats_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
          p_top_agences?: number
          p_top_gestionnaires?: number
        }
        Returns: Json
      }
      get_artisan_previous_status: {
        Args: { p_artisan_id: string; p_before_status_code?: string }
        Returns: {
          changed_at: string
          status_code: string
          status_id: string
          status_label: string
        }[]
      }
      get_current_podium_period: { Args: never; Returns: Json }
      get_current_user_id: { Args: never; Returns: string }
      get_dashboard_conversion_funnel_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_cycles_moyens_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_kpi_main_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_performance_agences_v3: {
        Args: {
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_performance_gestionnaires_v3: {
        Args: {
          p_agence_ids?: string[]
          p_limit?: number
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_performance_metiers_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_sparkline_data_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_status_breakdown_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_dashboard_volume_by_status_v3: {
        Args: {
          p_agence_ids?: string[]
          p_gestionnaire_ids?: string[]
          p_metier_ids?: string[]
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      get_intervention_history: {
        Args: { p_intervention_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          action_label: string
          action_type: string
          actor_code: string
          actor_color: string
          actor_display: string
          changed_fields: string[]
          id: string
          metadata: Json
          new_values: Json
          occurred_at: string
          old_values: Json
          related_entity_id: string
          related_entity_type: string
          source: string
        }[]
      }
      get_period_dates: {
        Args: { period_type: string; reference_date?: string }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      get_podium_ranking_by_period: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: Json
      }
      get_public_user_id: { Args: never; Returns: string }
      get_user_permissions: {
        Args: { p_user_id: string }
        Returns: {
          granted: boolean
          permission_key: string
          source: string
        }[]
      }
      jsonb_diff: {
        Args: { p_exclude_keys?: string[]; p_new: Json; p_old: Json }
        Returns: {
          changed_fields: string[]
          new_values: Json
          old_values: Json
        }[]
      }
      log_status_transition_from_api: {
        Args: {
          p_changed_by_user_id?: string
          p_from_status_id: string
          p_intervention_id: string
          p_metadata?: Json
          p_to_status_id: string
        }
        Returns: string
      }
      recalculate_artisan_status: {
        Args: { artisan_uuid: string }
        Returns: string
      }
      refresh_artisans_search: { Args: never; Returns: undefined }
      refresh_current_podium_period: { Args: never; Returns: undefined }
      refresh_dashboard_cache: { Args: never; Returns: undefined }
      refresh_interventions_search: { Args: never; Returns: undefined }
      refresh_search_views_if_needed: { Args: never; Returns: undefined }
      resolve_actor_user_id: {
        Args: { p_explicit_user_id?: string; p_fallback_user_id?: string }
        Returns: string
      }
      search_artisans: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          active_interventions_count: number
          email: string
          id: string
          metiers_labels: string
          numero_associe: string
          plain_nom: string
          raison_sociale: string
          rank: number
          statut_color: string
          statut_label: string
          telephone: string
          ville_intervention: string
        }[]
      }
      search_global: {
        Args: {
          p_entity_type?: string
          p_limit?: number
          p_offset?: number
          p_query: string
        }
        Returns: {
          entity_id: string
          entity_type: string
          metadata: Json
          rank: number
        }[]
      }
      search_interventions: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          adresse: string
          agence_label: string
          artisan_plain_nom: string
          contexte_intervention: string
          date_formatted: string
          id: string
          id_inter: string
          rank: number
          statut_color: string
          statut_label: string
          ville: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      user_has_any_role: { Args: { role_names: string[] }; Returns: boolean }
      user_has_permission: {
        Args: { p_permission_key: string; p_user_id: string }
        Returns: boolean
      }
      user_has_role: { Args: { role_name: string }; Returns: boolean }
      validate_artisan_portal_token: {
        Args: { p_token: string }
        Returns: {
          artisan_id: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      target_period_type: "week" | "month" | "year"
      user_status: "connected" | "dnd" | "busy" | "offline" | "archived"
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
      target_period_type: ["week", "month", "year"],
      user_status: ["connected", "dnd", "busy", "offline", "archived"],
    },
  },
} as const
