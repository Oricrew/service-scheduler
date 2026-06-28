"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAgendaOrganization } from "@/lib/agenda/queries";
import {
  assignSuccessParam,
  assignSuccessValue,
  confirmSuccessParam,
  confirmSuccessValue,
  durationPresets,
  schedulingConflictParam,
  schedulingConflictValue,
} from "@/lib/appointments/constants";
import { canAssignStatus, canConfirmStatus } from "@/lib/appointments/status";
import { sendAppointmentConfirmationEmail } from "@/lib/email/send-appointment-confirmation-email";
import { requireRole } from "@/lib/auth";
import { getAppointmentSchedulingWindow } from "@/lib/scheduling/appointment-window";
import { getBlockedWindowEnd } from "@/lib/scheduling/blocked-window";
import { findTechnicianSchedulingConflicts } from "@/lib/scheduling/conflicts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MaybeArray<T> = T | T[] | null;
type AppointmentClient = { name: string; email: string };
type AppointmentService = { name: string };
type AppointmentTechnicianAssignment = {
  technician_id: string;
  technicians: MaybeArray<{ name: string }>;
};

function readTechnicianIds(formData: FormData) {
  return formData.getAll("technicianIds").map(String).filter(Boolean);
}

function asArray<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function redirectOnSchedulingConflict(locale: string, appointmentId: string) {
  redirect(
    `/${locale}/dashboard/appointments/${appointmentId}?${schedulingConflictParam}=${schedulingConflictValue}`,
  );
}

async function assertNoSchedulingConflicts(input: {
  organizationId: string;
  appointmentId: string;
  technicianIds: string[];
  startAt: string;
  durationMinutes: number;
  travelBufferMinutes: number;
  locale: string;
}) {
  const conflicts = await findTechnicianSchedulingConflicts({
    organizationId: input.organizationId,
    appointmentId: input.appointmentId,
    technicianIds: input.technicianIds,
    startAt: input.startAt,
    durationMinutes: input.durationMinutes,
    travelBufferMinutes: input.travelBufferMinutes,
  });

  if (conflicts.length > 0) {
    redirectOnSchedulingConflict(input.locale, input.appointmentId);
  }
}

function getTechnicianNames(
  assignmentRows: MaybeArray<AppointmentTechnicianAssignment>,
) {
  return asArray(assignmentRows).flatMap((assignment) =>
    asArray(assignment.technicians).map((technician) => technician.name),
  );
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
        confirmed_start_at,
        estimated_duration_minutes,
        travel_buffer_minutes,
        address,
        city,
        clients (name, email),
        services (name, default_duration_minutes),
        appointment_technicians (
          technician_id,
          technicians (name)
        )
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

  const { startAt, durationMinutes, travelBufferMinutes } =
    getAppointmentSchedulingWindow(appointment);
  const assignmentRows =
    appointment.appointment_technicians as unknown as MaybeArray<AppointmentTechnicianAssignment>;
  const technicianIds = asArray(assignmentRows).map(
    (assignment) => assignment.technician_id,
  );

  if (technicianIds.length > 0) {
    await assertNoSchedulingConflicts({
      organizationId: organization.id,
      appointmentId,
      technicianIds,
      startAt,
      durationMinutes,
      travelBufferMinutes,
      locale,
    });
  }

  const confirmedStartAt = appointment.requested_start_at;
  const confirmedEndAt = getBlockedWindowEnd(
    confirmedStartAt,
    durationMinutes,
    travelBufferMinutes,
  );

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

  const client = appointment.clients as unknown as AppointmentClient;
  const service = appointment.services as unknown as AppointmentService;

  await sendAppointmentConfirmationEmail({
    locale,
    to: client.email,
    clientName: client.name,
    serviceName: service.name,
    confirmedStartAt,
    timezone: organization.timezone,
    address: appointment.address as string,
    city: appointment.city as string,
    technicianNames: getTechnicianNames(assignmentRows),
  });

  revalidatePath(`/${locale}/dashboard/appointments/${appointmentId}`);
  revalidatePath(`/${locale}/dashboard/requests`);
  revalidatePath(`/${locale}/dashboard/agenda`);
  redirect(
    `/${locale}/dashboard/appointments/${appointmentId}?${confirmSuccessParam}=${confirmSuccessValue}`,
  );
}

export async function assignTechnicians(
  locale: string,
  appointmentId: string,
  formData: FormData,
) {
  const user = await requireRole("supervisor");
  const organization = await getAgendaOrganization();
  const supabase = createSupabaseAdminClient();
  const technicianIds = readTechnicianIds(formData);

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `
        id,
        status,
        requested_start_at,
        confirmed_start_at,
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

  if (!canAssignStatus(appointment.status)) {
    throw new Error("Technicians cannot be assigned to this appointment.");
  }

  if (technicianIds.length > 0) {
    const { data: technicians, error: techniciansError } = await supabase
      .from("technicians")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .in("id", technicianIds);

    if (techniciansError || technicians?.length !== technicianIds.length) {
      throw new Error("Invalid technician selection.");
    }

    const { startAt, durationMinutes, travelBufferMinutes } =
      getAppointmentSchedulingWindow(appointment);

    await assertNoSchedulingConflicts({
      organizationId: organization.id,
      appointmentId,
      technicianIds,
      startAt,
      durationMinutes,
      travelBufferMinutes,
      locale,
    });
  }

  const { error: deleteError } = await supabase
    .from("appointment_technicians")
    .delete()
    .eq("appointment_id", appointmentId);

  if (deleteError) {
    throw new Error("Could not update technician assignments.");
  }

  if (technicianIds.length > 0) {
    const { error: insertError } = await supabase
      .from("appointment_technicians")
      .insert(
        technicianIds.map((technicianId) => ({
          appointment_id: appointmentId,
          technician_id: technicianId,
        })),
      );

    if (insertError) {
      throw new Error("Could not save technician assignments.");
    }
  }

  const { error: eventError } = await supabase
    .from("appointment_events")
    .insert({
      appointment_id: appointmentId,
      actor_user_id: user.id,
      event_type: "technician_assigned",
      metadata: { technician_ids: technicianIds },
    });

  if (eventError) {
    throw new Error("Could not log appointment event.");
  }

  revalidatePath(`/${locale}/dashboard/appointments/${appointmentId}`);
  revalidatePath(`/${locale}/dashboard/agenda`);
  redirect(
    `/${locale}/dashboard/appointments/${appointmentId}?${assignSuccessParam}=${assignSuccessValue}`,
  );
}

export async function removeTechnician(
  locale: string,
  appointmentId: string,
  technicianId: string,
) {
  const user = await requireRole("supervisor");
  const organization = await getAgendaOrganization();
  const supabase = createSupabaseAdminClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !appointment) {
    throw new Error("Appointment not found.");
  }

  if (!canAssignStatus(appointment.status)) {
    throw new Error("Technicians cannot be removed from this appointment.");
  }

  const { data: technician, error: technicianError } = await supabase
    .from("technicians")
    .select("id")
    .eq("id", technicianId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (technicianError || !technician) {
    throw new Error("Invalid technician.");
  }

  const { error: deleteError } = await supabase
    .from("appointment_technicians")
    .delete()
    .eq("appointment_id", appointmentId)
    .eq("technician_id", technicianId);

  if (deleteError) {
    throw new Error("Could not remove technician assignment.");
  }

  const { error: eventError } = await supabase
    .from("appointment_events")
    .insert({
      appointment_id: appointmentId,
      actor_user_id: user.id,
      event_type: "technician_removed",
      metadata: { technician_id: technicianId },
    });

  if (eventError) {
    throw new Error("Could not log appointment event.");
  }

  revalidatePath(`/${locale}/dashboard/appointments/${appointmentId}`);
  revalidatePath(`/${locale}/dashboard/agenda`);
  redirect(`/${locale}/dashboard/appointments/${appointmentId}`);
}

export async function updateEstimatedDuration(
  locale: string,
  appointmentId: string,
  durationMinutes: number,
) {
  if (!(durationPresets as readonly number[]).includes(durationMinutes)) {
    throw new Error("Invalid duration.");
  }

  const user = await requireRole("supervisor");
  const organization = await getAgendaOrganization();
  const supabase = createSupabaseAdminClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `
        id,
        status,
        confirmed_start_at,
        travel_buffer_minutes,
        appointment_technicians (technician_id)
      `,
    )
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !appointment) {
    throw new Error("Appointment not found.");
  }

  if (!canAssignStatus(appointment.status)) {
    throw new Error("Duration cannot be updated for this appointment.");
  }

  if (appointment.status === "confirmed" && appointment.confirmed_start_at) {
    const assignmentRows = appointment.appointment_technicians as
      | { technician_id: string }[]
      | { technician_id: string }
      | null;
    const technicianIds = (
      Array.isArray(assignmentRows)
        ? assignmentRows
        : assignmentRows
          ? [assignmentRows]
          : []
    ).map((assignment) => assignment.technician_id);

    if (technicianIds.length > 0) {
      await assertNoSchedulingConflicts({
        organizationId: organization.id,
        appointmentId,
        technicianIds,
        startAt: appointment.confirmed_start_at,
        durationMinutes,
        travelBufferMinutes: appointment.travel_buffer_minutes,
        locale,
      });
    }
  }

  const updatePayload: {
    estimated_duration_minutes: number;
    updated_at: string;
    confirmed_end_at?: string;
  } = {
    estimated_duration_minutes: durationMinutes,
    updated_at: new Date().toISOString(),
  };

  if (appointment.status === "confirmed" && appointment.confirmed_start_at) {
    updatePayload.confirmed_end_at = getBlockedWindowEnd(
      appointment.confirmed_start_at,
      durationMinutes,
      appointment.travel_buffer_minutes,
    );
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", appointmentId)
    .eq("organization_id", organization.id);

  if (updateError) {
    throw new Error("Could not update estimated duration.");
  }

  const { error: eventError } = await supabase
    .from("appointment_events")
    .insert({
      appointment_id: appointmentId,
      actor_user_id: user.id,
      event_type: "duration_updated",
      metadata: { estimated_duration_minutes: durationMinutes },
    });

  if (eventError) {
    throw new Error("Could not log appointment event.");
  }

  revalidatePath(`/${locale}/dashboard/appointments/${appointmentId}`);
  revalidatePath(`/${locale}/dashboard/agenda`);
  redirect(`/${locale}/dashboard/appointments/${appointmentId}`);
}
