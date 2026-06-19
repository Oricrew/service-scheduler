"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAgendaOrganization } from "@/lib/agenda/queries";
import {
  confirmSuccessParam,
  confirmSuccessValue,
} from "@/lib/appointments/constants";
import { requireRole } from "@/lib/auth";
import { pendingRequestStatuses } from "@/lib/requests/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function canConfirmStatus(status: string) {
  return (pendingRequestStatuses as readonly string[]).includes(status);
}

export async function confirmAppointment(
  locale: string,
  appointmentId: string,
) {
  const user = await requireRole("supervisor");
  const organization = await getAgendaOrganization();
  const supabase = createSupabaseAdminClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `
        id,
        status,
        requested_start_at,
        estimated_duration_minutes,
        travel_buffer_minutes,
        services (default_duration_minutes)
      `,
    )
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !appointment) {
    throw new Error("Appointment not found.");
  }

  if (!canConfirmStatus(appointment.status)) {
    throw new Error("Appointment cannot be confirmed.");
  }

  const serviceRelation = appointment.services as
    | { default_duration_minutes: number }
    | { default_duration_minutes: number }[];
  const service = Array.isArray(serviceRelation)
    ? serviceRelation[0]
    : serviceRelation;

  if (!service) {
    throw new Error("Service not found.");
  }

  const durationMinutes =
    appointment.estimated_duration_minutes ?? service.default_duration_minutes;
  const confirmedStartAt = appointment.requested_start_at;
  const confirmedEndAt = new Date(
    new Date(confirmedStartAt).getTime() +
      (durationMinutes + appointment.travel_buffer_minutes) * 60_000,
  ).toISOString();

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      confirmed_start_at: confirmedStartAt,
      confirmed_end_at: confirmedEndAt,
      estimated_duration_minutes: durationMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("organization_id", organization.id);

  if (updateError) {
    throw new Error("Could not confirm appointment.");
  }

  const { error: eventError } = await supabase
    .from("appointment_events")
    .insert({
      appointment_id: appointmentId,
      actor_user_id: user.id,
      event_type: "confirmed",
    });

  if (eventError) {
    throw new Error("Could not log appointment event.");
  }

  revalidatePath(`/${locale}/dashboard/appointments/${appointmentId}`);
  revalidatePath(`/${locale}/dashboard/requests`);
  revalidatePath(`/${locale}/dashboard/agenda`);
  redirect(
    `/${locale}/dashboard/appointments/${appointmentId}?${confirmSuccessParam}=${confirmSuccessValue}`,
  );
}
