import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getAgendaPageData } from "@/lib/agenda/queries";
import { formatTime, getAgendaHref } from "@/lib/agenda/utils";
import { getUserRole, hasMinimumRole } from "@/lib/auth";
import { getPendingRequestsPageData } from "@/lib/requests/queries";

function formatRequestedAt(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function DashboardPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DashboardHome" });
  const [agendaData, userRole] = await Promise.all([
    getAgendaPageData({ view: "daily" }),
    getUserRole(),
  ]);
  const canManageRequests = hasMinimumRole(userRole, "supervisor");
  const requestsData = canManageRequests
    ? await getPendingRequestsPageData()
    : null;
  const pendingRequests = requestsData?.requests ?? [];
  const todayAppointments = agendaData.appointments;

  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-700">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-4xl font-black leading-none tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          {t("description")}
        </p>
      </div>

      <div
        className={[
          "grid gap-4",
          canManageRequests ? "md:grid-cols-2" : "md:grid-cols-1",
        ].join(" ")}
      >
        {canManageRequests ? (
          <Link
            className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-sky-300 sm:p-6"
            href={`/${locale}/dashboard/requests`}
          >
            <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
              {t("cards.pending.label")}
            </p>
            <p className="mt-4 text-5xl font-black text-slate-950">
              {pendingRequests.length}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {t("cards.pending.description")}
            </p>
          </Link>
        ) : null}

        <Link
          className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-sky-300 sm:p-6"
          href={getAgendaHref(locale, "daily", agendaData.today)}
        >
          <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
            {t("cards.today.label")}
          </p>
          <p className="mt-4 text-5xl font-black text-slate-950">
            {todayAppointments.length}
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            {t("cards.today.description")}
          </p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {canManageRequests ? (
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
                  {t("pendingPreview.eyebrow")}
                </p>
                <h2 className="mt-3 text-2xl font-black text-slate-950">
                  {t("pendingPreview.title")}
                </h2>
              </div>
              <Link
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                href={`/${locale}/dashboard/requests`}
              >
                {t("viewAll")}
              </Link>
            </div>

            {pendingRequests.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {pendingRequests.slice(0, 3).map((request) => (
                  <Link
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50/50"
                    href={`/${locale}/dashboard/appointments/${request.id}`}
                    key={request.id}
                  >
                    <p className="text-base font-black text-slate-950">
                      {request.clients.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {request.services.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatRequestedAt(
                        request.requested_start_at,
                        locale,
                        agendaData.organization.timezone,
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {t("pendingPreview.empty")}
              </p>
            )}
          </div>
        ) : null}

        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
                {t("todayPreview.eyebrow")}
              </p>
              <h2 className="mt-3 text-2xl font-black text-slate-950">
                {t("todayPreview.title")}
              </h2>
            </div>
            <Link
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
              href={getAgendaHref(locale, "daily", agendaData.today)}
            >
              {t("viewAll")}
            </Link>
          </div>

          {todayAppointments.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {todayAppointments.slice(0, 3).map((appointment) => {
                const appointmentTime =
                  appointment.confirmed_start_at ??
                  appointment.requested_start_at;

                return (
                  <Link
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50/50"
                    href={`/${locale}/dashboard/appointments/${appointment.id}`}
                    key={appointment.id}
                  >
                    <p className="text-base font-black text-slate-950">
                      {formatTime(
                        appointmentTime,
                        locale,
                        agendaData.organization.timezone,
                      )}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {appointment.clients.name} · {appointment.services.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {appointment.address}, {appointment.city}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {t("todayPreview.empty")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
