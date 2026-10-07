import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageShell } from "@/components/page-shell";
import { privatePageRobots } from "@/lib/seo/metadata";
import { hashAppointmentToken } from "@/lib/appointment-tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AppointmentRecord = {
  status: string;
  requested_start_at: string;
  confirmed_start_at: string | null;
  confirmed_end_at: string | null;
  address: string;
  city: string;
  equipment_type: string;
  brand_model: string | null;
  problem_description: string;
  client_notes: string | null;
  clients: {
    name: string;
    email: string;
    phone: string;
  };
  services: {
    name: string;
  };
  organizations: {
    timezone: string;
  };
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: privatePageRobots,
};

function formatDateTime(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

async function getAppointment(token: string) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashAppointmentToken(token);

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
        status,
        requested_start_at,
        confirmed_start_at,
        confirmed_end_at,
        address,
        city,
        equipment_type,
        brand_model,
        problem_description,
        client_notes,
        clients (name, email, phone),
        organizations (timezone),
        services (name)
      `,
    )
    .eq("secure_token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as AppointmentRecord;
}

export default async function AppointmentPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string; token: string }>;
}>) {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "AppointmentClient" });
  const appointment = await getAppointment(token);

  if (!appointment) {
    notFound();
  }

  const appointmentTime =
    appointment.confirmed_start_at ?? appointment.requested_start_at;

  return (
    <PageShell>
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-700">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-4xl font-black leading-none tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          {t("statusLabel")}{" "}
          <span className="text-slate-950">{appointment.status}</span>
        </p>

        <dl className="mt-8 grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-slate-500">{t("fields.client")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.clients.name}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("fields.service")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.services.name}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("fields.dateTime")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatDateTime(
                appointmentTime,
                locale,
                appointment.organizations.timezone,
              )}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("fields.contact")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.clients.phone}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">{t("fields.address")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.address}, {appointment.city}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">
              {t("fields.equipment")}
            </dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.equipment_type}
              {appointment.brand_model ? ` - ${appointment.brand_model}` : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">{t("fields.problem")}</dt>
            <dd className="mt-1 leading-6 text-slate-700">
              {appointment.problem_description}
            </dd>
          </div>
          {appointment.client_notes ? (
            <div className="sm:col-span-2">
              <dt className="font-bold text-slate-500">{t("fields.notes")}</dt>
              <dd className="mt-1 leading-6 text-slate-700">
                {appointment.client_notes}
              </dd>
            </div>
          ) : null}
        </dl>

        <Link
          className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
          href={`/${locale}`}
        >
          {t("backToHome")}
        </Link>
      </div>
    </PageShell>
  );
}
