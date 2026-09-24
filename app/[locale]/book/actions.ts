"use server";

import { redirect } from "next/navigation";

import {
  createAppointmentToken,
  hashAppointmentToken,
} from "@/lib/appointment-tokens";
import {
  buildAppointmentUrl,
  sendAppointmentRequestEmail,
} from "@/lib/email/send-appointment-request-email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

const INITIAL_ORGANIZATION_SLUG = "demo-service-company";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export type BookingFormState = {
  error: "invalidDateTime" | null;
};

class BookingValidationError extends Error {}

const serviceSlugs = [
  "repair",
  "maintenance",
  "installation",
  "quotation-inspection",
  "emergency-service",
] as const;

type ServiceSlug = (typeof serviceSlugs)[number];
type BookingField =
  | "serviceType"
  | "requestedDate"
  | "requestedTime"
  | "name"
  | "phone"
  | "email"
  | "address"
  | "city"
  | "equipmentType"
  | "problemDescription";

type BookingRequest = {
  serviceSlug: ServiceSlug;
  requestedDate: string;
  requestedTime: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  equipmentType: string;
  problemDescription: string;
  brandModel: string | null;
  clientNotes: string | null;
};

function isServiceSlug(value: string): value is ServiceSlug {
  return serviceSlugs.includes(value as ServiceSlug);
}

function getAppointmentPath(locale: string, token: string) {
  return `/${locale}/appointment/${token}`;
}

function getRequiredField(formData: FormData, field: BookingField) {
  const value = formData.get(field);
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    throw new BookingValidationError(`Missing required field: ${field}`);
  }

  return normalizedValue;
}

function getOptionalField(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function assertValidDateTimeFormat(date: string, time: string) {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    throw new BookingValidationError("Invalid requested date or time.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const selectedDate = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    selectedDate.getUTCFullYear() === year &&
    selectedDate.getUTCMonth() === month - 1 &&
    selectedDate.getUTCDate() === day;
  const [hour, minute] = time.split(":").map(Number);
  const isValidTime = hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;

  if (!isValidDate || !isValidTime) {
    throw new BookingValidationError("Invalid requested date or time.");
  }
}

function isWorkingHoursSlot(date: string, time: string) {
  assertValidDateTimeFormat(date, time);

  const selectedDate = new Date(`${date}T00:00:00`);
  const day = selectedDate.getDay();
  const [hour, minute] = time.split(":").map(Number);

  if (minute !== 0 && minute !== 30) {
    return false;
  }

  const isWeekdaySlot = day >= 1 && day <= 5 && hour >= 8 && hour < 18;
  const isSaturdaySlot = day === 6 && hour >= 9 && hour < 16;

  return isWeekdaySlot || isSaturdaySlot;
}

function getTimezoneOffset(date: Date, timezone: string) {
  const timezoneDate = new Date(
    date.toLocaleString("en-US", { timeZone: timezone }),
  );

  return timezoneDate.getTime() - date.getTime();
}

function createRequestedStartAt(date: string, time: string, timezone: string) {
  assertValidDateTimeFormat(date, time);

  if (!isWorkingHoursSlot(date, time)) {
    throw new BookingValidationError("Invalid time slot.");
  }

  const utcGuess = new Date(`${date}T${time}:00.000Z`);
  const timezoneOffset = getTimezoneOffset(utcGuess, timezone);

  return new Date(utcGuess.getTime() - timezoneOffset).toISOString();
}

function parseServiceSlug(value: string) {
  if (isServiceSlug(value)) {
    return value;
  }

  throw new BookingValidationError("Invalid service type.");
}

function readBookingRequest(formData: FormData): BookingRequest {
  const serviceSlug = parseServiceSlug(
    getRequiredField(formData, "serviceType"),
  );
  const requestedDate = getRequiredField(formData, "requestedDate");
  const requestedTime = getRequiredField(formData, "requestedTime");

  if (!isWorkingHoursSlot(requestedDate, requestedTime)) {
    throw new BookingValidationError(
      "Requested time is outside working hours.",
    );
  }

  return {
    serviceSlug,
    requestedDate,
    requestedTime,
    name: getRequiredField(formData, "name"),
    phone: getRequiredField(formData, "phone"),
    email: getRequiredField(formData, "email"),
    address: getRequiredField(formData, "address"),
    city: getRequiredField(formData, "city"),
    equipmentType: getRequiredField(formData, "equipmentType"),
    problemDescription: getRequiredField(formData, "problemDescription"),
    brandModel: getOptionalField(formData, "brandModel"),
    clientNotes: getOptionalField(formData, "clientNotes"),
  };
}

async function getOrganization(supabase: SupabaseAdminClient) {
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, timezone")
    .eq("slug", INITIAL_ORGANIZATION_SLUG)
    .single();

  if (organizationError || !organization) {
    throw new Error("Organization not found.");
  }

  return {
    id: organization.id as string,
    timezone: organization.timezone as string,
  };
}

async function getService(
  supabase: SupabaseAdminClient,
  organizationId: string,
  serviceSlug: string,
) {
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("slug", serviceSlug)
    .eq("active", true)
    .single();

  if (serviceError || !service) {
    throw new Error("Service not found.");
  }

  return {
    id: service.id as string,
    name: service.name as string,
  };
}

async function findOrCreateClient(
  supabase: SupabaseAdminClient,
  organizationId: string,
  booking: BookingRequest,
) {
  const { data: existingClient, error: existingClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", booking.email)
    .eq("phone", booking.phone)
    .maybeSingle();

  if (existingClientError) {
    throw new Error("Could not check existing client.");
  }

  if (existingClient) {
    return existingClient.id as string;
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      address: booking.address,
      city: booking.city,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error("Could not create client.");
  }

  return client.id as string;
}

async function createPendingAppointment(
  supabase: SupabaseAdminClient,
  organizationId: string,
  serviceId: string,
  clientId: string,
  booking: BookingRequest,
  timezone: string,
) {
  const secureToken = createAppointmentToken();
  const secureTokenHash = hashAppointmentToken(secureToken);
  const requestedStartAt = createRequestedStartAt(
    booking.requestedDate,
    booking.requestedTime,
    timezone,
  );

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      service_id: serviceId,
      status: "pending",
      requested_start_at: requestedStartAt,
      address: booking.address,
      city: booking.city,
      equipment_type: booking.equipmentType,
      brand_model: booking.brandModel,
      problem_description: booking.problemDescription,
      client_notes: booking.clientNotes,
      secure_token_hash: secureTokenHash,
    })
    .select("id")
    .single();

  if (appointmentError || !appointment) {
    throw new Error("Could not create appointment.");
  }

  return { secureToken, requestedStartAt };
}

export async function createAppointmentRequest(
  locale: string,
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  let booking: BookingRequest;

  try {
    booking = readBookingRequest(formData);
  } catch (error) {
    if (error instanceof BookingValidationError) {
      return { error: "invalidDateTime" };
    }

    throw error;
  }

  const supabase = createSupabaseAdminClient();

  const organization = await getOrganization(supabase);
  const service = await getService(
    supabase,
    organization.id,
    booking.serviceSlug,
  );
  const clientId = await findOrCreateClient(supabase, organization.id, booking);

  const { secureToken, requestedStartAt } = await createPendingAppointment(
    supabase,
    organization.id,
    service.id,
    clientId,
    booking,
    organization.timezone,
  );

  const appointmentUrl = buildAppointmentUrl(locale, secureToken);

  if (appointmentUrl) {
    await sendAppointmentRequestEmail({
      locale,
      to: booking.email,
      clientName: booking.name,
      serviceName: service.name,
      requestedStartAt,
      timezone: organization.timezone,
      address: booking.address,
      city: booking.city,
      appointmentUrl,
    });
  }

  redirect(getAppointmentPath(locale, secureToken));
}
