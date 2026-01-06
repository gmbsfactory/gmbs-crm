import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { normalizeReminderIdentifier } from "@/contexts/RemindersContext";

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

export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<MentionableUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Exclude archived users - they are soft-deleted and should not be selectable
      const { data, error: queryError } = await supabase
        .from("users")
        .select("id, firstname, lastname, username, email, code_gestionnaire")
        .neq("status", "archived")
        .order("firstname", { ascending: true, nullsFirst: true });

      if (queryError) throw queryError;

      const mapped: MentionableUser[] =
        data?.map((user) => {
          const displayParts = [user.firstname, user.lastname].filter(Boolean);
          const displayName =
            displayParts.length > 0
              ? displayParts.join(" ")
              : user.username ?? user.email ?? "Utilisateur";

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
            email: user.email,
            searchText,
          };
        }) ?? [];

      setUsers(mapped);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refresh: fetchUsers,
  };
}
