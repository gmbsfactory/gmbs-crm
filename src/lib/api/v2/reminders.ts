import { supabase } from "@/lib/supabase-client";
import type { InterventionReminder } from "./common/types";

type ReminderRow = InterventionReminder & {
  mentioned_user_ids: string[] | null;
};

const USER_FIELDS = "id, firstname, lastname, email";
const REMINDER_SELECT = `*, user:users!intervention_reminders_user_id_fkey(${USER_FIELDS})`;

// Normaliser la note : nettoyer les valeurs pour l'affichage
function normalizeNoteForDisplay(note: string | null | undefined): string | null {
  if (!note) return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function enrichMentionedUsers(reminders: ReminderRow[]): Promise<InterventionReminder[]> {
  const mentionedIds = new Set<string>();
  reminders.forEach((reminder) => {
    (reminder.mentioned_user_ids ?? []).forEach((id) => mentionedIds.add(id));
  });

  if (mentionedIds.size === 0) {
    return reminders.map((reminder) => ({
      ...reminder,
      note: normalizeNoteForDisplay(reminder.note),
      mentioned_user_ids: reminder.mentioned_user_ids ?? [],
      mentioned_users: [],
    }));
  }

  const { data: users, error } = await supabase
    .from("users")
    .select(USER_FIELDS)
    .in("id", Array.from(mentionedIds));

  if (error) throw error;

  const usersById = new Map(users?.map((user) => [user.id, user]));

  return reminders.map((reminder) => {
    const ids = reminder.mentioned_user_ids ?? [];
    return {
      ...reminder,
      note: normalizeNoteForDisplay(reminder.note),
      mentioned_user_ids: ids,
      mentioned_users: ids
        .map((id) => usersById.get(id))
        .filter(Boolean) as InterventionReminder["mentioned_users"],
    };
  });
}

// Plus de validation stricte - on permet les reminders vides (sans note ni date)
// La contrainte CHECK a été supprimée pour permettre cette fonctionnalité

export const remindersApi = {
  async getMyReminders(): Promise<InterventionReminder[]> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Récupérer le public.users.id correspondant à l'utilisateur auth
    const { data: publicUser } = await supabase
      .from("users")
      .select("id")
      .or(`auth_user_id.eq.${user.id},email.ilike.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (!publicUser) {
      // Pas de profil utilisateur trouvé, retourner une liste vide
      console.warn(`No public user profile found for auth user ${user.id}`);
      return [];
    }

    const publicUserId = publicUser.id;

    const { data, error } = await supabase
      .from("intervention_reminders")
      .select(REMINDER_SELECT)
      .or(`user_id.eq.${publicUserId},mentioned_user_ids.cs.{${publicUserId}}`)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return enrichMentionedUsers(data as ReminderRow[]);
  },

  async upsertReminder(params: {
    intervention_id: string;
    note?: string | null;
    due_date?: string | null;
    mentioned_user_ids?: string[];
  }): Promise<InterventionReminder> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Récupérer le public.users.id correspondant à l'utilisateur auth
    // On cherche d'abord par auth_user_id, sinon par email
    const { data: publicUser, error: publicUserError } = await supabase
      .from("users")
      .select("id")
      .or(`auth_user_id.eq.${user.id},email.ilike.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (publicUserError) {
      console.error("Error fetching public user:", publicUserError);
      throw new Error("Unable to find user profile");
    }

    if (!publicUser) {
      throw new Error(`User profile not found for email ${user.email}. Please contact administrator.`);
    }

    const publicUserId = publicUser.id;

    const { data: existing, error: existingError } = await supabase
      .from("intervention_reminders")
      .select("id")
      .eq("intervention_id", params.intervention_id)
      .eq("user_id", publicUserId)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    // Normaliser les valeurs : permettre les reminders vides (sans note ni date)
    // La contrainte CHECK a été supprimée pour permettre cette fonctionnalité
    const trimmedNote = params.note?.trim();
    const trimmedDueDate = params.due_date?.trim();
    
    // Si note existe et n'est pas vide, l'utiliser
    // Sinon, mettre note à null (même si due_date existe ou non)
    const hasNote = trimmedNote && trimmedNote.length > 0;
    const hasDueDate = trimmedDueDate && trimmedDueDate.length > 0;
    
    const normalizedNote = hasNote ? trimmedNote : null;
    const normalizedDueDate = hasDueDate ? trimmedDueDate : null;

    const payload = {
      note: normalizedNote,
      due_date: normalizedDueDate,
      mentioned_user_ids: params.mentioned_user_ids ?? [],
      is_active: true, // Toujours mettre is_active à true lors de la création/mise à jour
    };

    if (existing) {
      const { data, error } = await supabase
        .from("intervention_reminders")
        .update(payload)
        .eq("id", existing.id)
        .select(REMINDER_SELECT)
        .single();

      if (error) throw error;
      return (await enrichMentionedUsers([data as ReminderRow]))[0]!;
    }

    const { data, error } = await supabase
      .from("intervention_reminders")
      .insert({
        intervention_id: params.intervention_id,
        user_id: publicUserId,
        ...payload,
      })
      .select(REMINDER_SELECT)
      .single();

    if (error) throw error;
    return (await enrichMentionedUsers([data as ReminderRow]))[0]!;
  },

  async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase
      .from("intervention_reminders")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async getReminderByIntervention(intervention_id: string): Promise<InterventionReminder | null> {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Récupérer le public.users.id correspondant à l'utilisateur auth
    const { data: publicUser } = await supabase
      .from("users")
      .select("id")
      .or(`auth_user_id.eq.${user.id},email.ilike.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (!publicUser) {
      return null;
    }

    const publicUserId = publicUser.id;

    const { data, error } = await supabase
      .from("intervention_reminders")
      .select(REMINDER_SELECT)
      .eq("intervention_id", intervention_id)
      .eq("user_id", publicUserId)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    if (!data) return null;

    return (await enrichMentionedUsers([data as ReminderRow]))[0] ?? null;
  },
};
