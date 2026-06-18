import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    throw new Error("Forbidden");
  }

  return user;
}
