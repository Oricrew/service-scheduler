import type { User } from "@supabase/supabase-js";
<<<<<<< HEAD

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "supervisor" | "technician";

const roleRank: Record<UserRole, number> = {
  technician: 1,
  supervisor: 2,
  admin: 3,
};

async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role as UserRole;
}

export function hasMinimumRole(
  userRole: UserRole | null,
  requiredRole: UserRole,
) {
  if (!userRole) {
    return false;
  }

  return roleRank[userRole] >= roleRank[requiredRole];
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await requireAuth();

  return fetchUserRole(user.id);
}

=======
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

>>>>>>> 62eac96 (Add shared server auth helpers and session refresh)
export async function requireAuth(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

<<<<<<< HEAD
export async function requireRole(requiredRole: UserRole): Promise<User> {
  const user = await requireAuth();
  const role = await fetchUserRole(user.id);

  if (!hasMinimumRole(role, requiredRole)) {
=======
export async function requireAuthOrRedirect(locale: string): Promise<User> {
  try {
    return await requireAuth();
  } catch {
    redirect(`/${locale}/login`);
  }
}

type UserRole = "admin" | "supervisor" | "technician";

const roleRank: Record<UserRole, number> = {
  technician: 1,
  supervisor: 2,
  admin: 3,
};

export async function requireRole(requiredRole: UserRole): Promise<User> {
  const user = await requireAuth();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (
    error ||
    !data ||
    roleRank[data.role as UserRole] < roleRank[requiredRole]
  ) {
>>>>>>> 62eac96 (Add shared server auth helpers and session refresh)
    throw new Error("Forbidden");
  }

  return user;
}
