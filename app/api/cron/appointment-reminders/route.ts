import { NextResponse } from "next/server";

import { addDays, createZonedDateTime, getTodayDate } from "@/lib/datetime";
import { sendAppointmentReminderEmail } from "@/lib/email/send-appointment-reminder-email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MaybeArray<T> = T | T[] | null;

type ReminderAppointment = {
  id: string;
  confirmed_start_at: string;
  address: string;
  city: string;
  clients: MaybeArray<{
    name: string;
    email: string;
  }>;
  services: MaybeArray<{
    name: string;
  }>;
  appointment_technicians: MaybeArray<{
    technicians: MaybeArray<{
      name: string;
    }>;
  }>;
};

function asArray<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function getAuthorizationToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

function getTechnicianNames(
  assignmentRows: ReminderAppointment["appointment_technicians"],
) {
  return asArray(assignmentRows).flatMap((assignment) =>
    asArray(assignment.technicians).map((technician) => technician.name),
  );
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || getAuthorizationToken(request) !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, timezone, default_locale");

  if (organizationsError || !organizations) {
    return NextResponse.json(
      { error: "Could not load organizations." },
      { status: 500 },
    );
  }

  const summary = {
    organizations: organizations.length,
    candidates: 0,
    sent: 0,
    failed: 0,
  };

  for (const organization of organizations) {
    const timezone = organization.timezone as string;
    const locale = organization.default_locale as string;
    const today = getTodayDate(timezone);
    const tomorrow = addDays(today, 1);
    const rangeStart = createZonedDateTime(today, "00:00", timezone);
    const rangeEnd = createZonedDateTime(tomorrow, "00:00", timezone);

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select(
        `
          id,
          confirmed_start_at,
          address,
          city,
          clients (name, email),
          services (name),
          appointment_technicians (
            technicians (name)
          )
        `,
      )
      .eq("organization_id", organization.id)
      .eq("status", "confirmed")
      .is("same_day_reminder_sent_at", null)
      .gte("confirmed_start_at", rangeStart)
      .lt("confirmed_start_at", rangeEnd)
      .order("confirmed_start_at", { ascending: true });

    if (appointmentsError || !appointments) {
      console.error("Could not load reminder appointments:", appointmentsError);
      summary.failed += 1;
      continue;
    }

    const reminderAppointments =
      appointments as unknown as ReminderAppointment[];
    summary.candidates += reminderAppointments.length;

    for (const appointment of reminderAppointments) {
      const client = asArray(appointment.clients)[0];
      const service = asArray(appointment.services)[0];

      if (!client || !service) {
        summary.failed += 1;
        continue;
      }

      await sendAppointmentReminderEmail({
        locale,
        to: client.email,
        clientName: client.name,
        serviceName: service.name,
        confirmedStartAt: appointment.confirmed_start_at,
        timezone,
        address: appointment.address,
        city: appointment.city,
        technicianNames: getTechnicianNames(
          appointment.appointment_technicians,
        ),
      });

      const { error: updateError } = await supabase
        .from("appointments")
        .update({ same_day_reminder_sent_at: new Date().toISOString() })
        .eq("id", appointment.id)
        .is("same_day_reminder_sent_at", null);

      if (updateError) {
        console.error("Could not mark reminder as sent:", updateError);
        summary.failed += 1;
        continue;
      }

      summary.sent += 1;
    }
  }

  return NextResponse.json(summary);
}
