import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { normalizeReminderIdentifier } from "@/lib/reminders/utils";
import { getUserDisplayName } from "@/utils/user-display-name";

export interface MentionableUser {
  id: string;
  displayName: string;
  handle: string;
  email: string | null;
  searchText: string;
}

interface UseUsersResult {
  users: MentionableUser[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const normalizeSafe = (value?: string | null): string => {
  if (!value) return "";
  return normalizeReminderIdentifier(value);
};

const buildHandle = (params: {
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
}): string => {
  const parts: string[] = [];
  const first = normalizeSafe(params.firstname);
  const last = normalizeSafe(params.lastname);
  if (first) parts.push(first);
  if (last) parts.push(last);
  const fromNames = parts.filter(Boolean).join(".");
  if (fromNames) return fromNames;

  const username = normalizeSafe(params.username);
  if (username) return username;

  if (params.email) {
    const local = params.email.split("@")[0] ?? "";
    if (local) {
      const normalizedLocal = normalizeSafe(local);
      if (normalizedLocal) {
        return normalizedLocal;
      }
    }
  }

  // fallback handle
  return "";
};

async function fetchMentionableUsers(): Promise<MentionableUser[]> {
  // Exclude archived users - they are soft-deleted and should not be selectable
  const { data, error: queryError } = await supabase
    .from("users")
    .select("id, firstname, lastname, username, email, code_gestionnaire")
    .neq("status", "archived")
    .order("firstname", { ascending: true, nullsFirst: true });

  if (queryError) throw queryError;

  return (
    data?.map((user: { id: string; firstname?: string | null; lastname?: string | null; username?: string | null; email?: string | null; code_gestionnaire?: string | null; [key: string]: unknown }) => {
      const displayName = getUserDisplayName(user, "Utilisateur");

      const handleFromNames = buildHandle({
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username,
        email: user.email,
      });

      const handle =
        handleFromNames || normalizeReminderIdentifier(user.code_gestionnaire ?? "") || user.id;

      const searchText = [
        displayName,
        user.username ?? "",
        user.email ?? "",
        user.code_gestionnaire ?? "",
        handle,
      ]
        .join(" ")
        .toLowerCase();

      return {
        id: user.id,
        displayName,
        handle,
        email: user.email ?? null,
        searchText,
      };
    }) ?? []
  );
}

export function useUsers(): UseUsersResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", "mentionable"],
    queryFn: fetchMentionableUsers,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["users", "mentionable"] });
  }, [queryClient]);

  return {
    users: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
