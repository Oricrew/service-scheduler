import { getAgendaOrganization } from "@/lib/agenda/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveTechnicians } from "@/lib/technicians/queries";

import type { AppointmentDetail } from "./types";

export type AppointmentDetailPageData = {
  organization: {
    id: string;
    timezone: string;
  };
  appointment: AppointmentDetail;
  activeTechnicians: Awaited<ReturnType<typeof getActiveTechnicians>>;
};

export async function getAppointmentDetailPageData(
  appointmentId: string,
): Promise<AppointmentDetailPageData | null> {
  const organization = await getAgendaOrganization();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
        id,
        status,
        requested_start_at,
        confirmed_start_at,
        created_at,
        address,
        city,
        equipment_type,
        brand_model,
        problem_description,
        client_notes,
        clients (name, email, phone),
        services (name, is_emergency),
        appointment_technicians (
          technician_id,
          technicians (name)
        )
      `,
    )
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const activeTechnicians = await getActiveTechnicians(organization.id);

  return {
    organization,
    appointment: data as unknown as AppointmentDetail,
    activeTechnicians,
  };
}
