export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          region: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
        ]
      }
      artisan_attachments: {
        Row: {
          artisan_id: string | null
          created_at: string | null
          file_size: number | null
          filename: string | null
          id: string
          kind: string
          mime_type: string | null
          url: string
        }
        Insert: {
          artisan_id?: string | null
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          url: string
        }
        Update: {
          artisan_id?: string | null
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          kind?: string
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
            foreignKeyName: "artisan_metiers_metier_id_fkey"
            columns: ["metier_id"]
            isOneToOne: false
            referencedRelation: "metiers"
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
          email: string | null
          gestionnaire_id: string | null
          id: string
          intervention_latitude: number | null
          intervention_longitude: number | null
          is_active: boolean | null
          nom: string | null
          numero_associe: string | null
          prenom: string | null
          raison_sociale: string | null
          siret: string | null
          iban: string | null
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
          email?: string | null
          gestionnaire_id?: string | null
          id?: string
          intervention_latitude?: number | null
          intervention_longitude?: number | null
          is_active?: boolean | null
          nom?: string | null
          numero_associe?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          siret?: string | null
          iban?: string | null
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
          email?: string | null
          gestionnaire_id?: string | null
          id?: string
          intervention_latitude?: number | null
          intervention_longitude?: number | null
          is_active?: boolean | null
          nom?: string | null
          numero_associe?: string | null
          prenom?: string | null
          raison_sociale?: string | null
          siret?: string | null
          iban?: string | null
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
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string | null
          email: string | null
          external_ref: string | null
          firstname: string | null
          id: string
          is_active: boolean | null
          lastname: string | null
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
          is_active?: boolean | null
          lastname?: string | null
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
          is_active?: boolean | null
          lastname?: string | null
          telephone?: string | null
          telephone2?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: []
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
            foreignKeyName: "intervention_artisans_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_attachments: {
        Row: {
          created_at: string | null
          file_size: number | null
          filename: string | null
          id: string
          intervention_id: string | null
          kind: string
          mime_type: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          intervention_id?: string | null
          kind: string
          mime_type?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          intervention_id?: string | null
          kind?: string
          mime_type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_attachments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_costs: {
        Row: {
          amount: number
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
          agence_id: string | null
          assigned_user_id: string | null
          client_id: string | null
          code_postal: string | null
          commentaire_agent: string | null
          consigne_intervention: string | null
          consigne_second_artisan: string | null
          contexte_intervention: string | null
          created_at: string | null
          date: string
          date_prevue: string | null
          date_termine: string | null
          due_date: string | null
          id: string
          id_inter: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          metier_id: string | null
          numero_sst: string | null
          pourcentage_sst: number | null
          statut_id: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          agence_id?: string | null
          assigned_user_id?: string | null
          client_id?: string | null
          code_postal?: string | null
          commentaire_agent?: string | null
          consigne_intervention?: string | null
          consigne_second_artisan?: string | null
          contexte_intervention?: string | null
          created_at?: string | null
          date: string
          date_prevue?: string | null
          date_termine?: string | null
          due_date?: string | null
          id?: string
          id_inter?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metier_id?: string | null
          numero_sst?: string | null
          pourcentage_sst?: number | null
          statut_id?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          agence_id?: string | null
          assigned_user_id?: string | null
          client_id?: string | null
          code_postal?: string | null
          commentaire_agent?: string | null
          consigne_intervention?: string | null
          consigne_second_artisan?: string | null
          contexte_intervention?: string | null
          created_at?: string | null
          date?: string
          date_prevue?: string | null
          date_termine?: string | null
          due_date?: string | null
          id?: string
          id_inter?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metier_id?: string | null
          numero_sst?: string | null
          pourcentage_sst?: number | null
          statut_id?: string | null
          updated_at?: string | null
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
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          label: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
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
        ]
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
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
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
        ]
      }
      users: {
        Row: {
          code_gestionnaire: string | null
          color: string | null
          created_at: string | null
          email: string | null
          firstname: string | null
          id: string
          last_seen_at: string | null
          lastname: string | null
          status: Database["public"]["Enums"]["user_status"]
          token_version: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          code_gestionnaire?: string | null
          color?: string | null
          created_at?: string | null
          email?: string | null
          firstname?: string | null
          id?: string
          last_seen_at?: string | null
          lastname?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          token_version?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          code_gestionnaire?: string | null
          color?: string | null
          created_at?: string | null
          email?: string | null
          firstname?: string | null
          id?: string
          last_seen_at?: string | null
          lastname?: string | null
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_status: "connected" | "dnd" | "busy" | "offline"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_status: ["connected", "dnd", "busy", "offline"],
    },
  },
} as const
