import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAppointmentDetailPageData } from "@/lib/appointments/queries";

export const dynamic = "force-dynamic";

function formatDateTime(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function DashboardAppointmentPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string; id: string }>;
}>) {
  const { locale, id } = await params;
  const pageData = await getAppointmentDetailPageData(id);

  if (!pageData) {
    notFound();
  }

  const { organization, appointment } = pageData;
  const t = await getTranslations({ locale, namespace: "AppointmentDetail" });
  const appointmentTime =
    appointment.confirmed_start_at ?? appointment.requested_start_at;
  const technicians = appointment.appointment_technicians
    .map((assignment) => assignment.technicians.name)
    .join(", ");

  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-700">
          {t("eyebrow")}
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-black leading-none tracking-tight">
              {appointment.clients.name}
            </h1>
            <p className="mt-3 text-lg font-semibold text-slate-600">
              {appointment.services.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {appointment.services.is_emergency ? (
              <span className="w-fit rounded-full bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-rose-800">
                {t("emergency")}
              </span>
            ) : null}
            <span className="w-fit rounded-full bg-sky-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-sky-800">
              {t(`statuses.${appointment.status}`)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-slate-500">{t("requestedAt")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatDateTime(appointmentTime, locale, organization.timezone)}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("submittedAt")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatDateTime(
                appointment.created_at,
                locale,
                organization.timezone,
              )}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("phone")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.clients.phone}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("email")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.clients.email}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">{t("address")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.address}, {appointment.city}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("equipment")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {appointment.equipment_type}
              {appointment.brand_model ? ` · ${appointment.brand_model}` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">{t("technicians")}</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {technicians || t("unassigned")}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">{t("problem")}</dt>
            <dd className="mt-1 leading-6 text-slate-700">
              {appointment.problem_description}
            </dd>
          </div>
          {appointment.client_notes ? (
            <div className="sm:col-span-2">
              <dt className="font-bold text-slate-500">{t("notes")}</dt>
              <dd className="mt-1 leading-6 text-slate-700">
                {appointment.client_notes}
              </dd>
            </div>
          ) : null}
        </dl>

        <Link
          className="mt-8 inline-flex rounded-full border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
          href={`/${locale}/dashboard/requests`}
        >
          {t("backToRequests")}
        </Link>
      </div>
    </section>
  );
}
