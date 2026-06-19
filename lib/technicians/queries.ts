import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActiveTechnician = {
  id: string;
  name: string;
};

export async function getActiveTechnicians(organizationId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("technicians")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Could not load technicians.");
  }

  return data as ActiveTechnician[];
}
