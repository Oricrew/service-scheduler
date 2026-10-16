import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui";
import { getAgendaPageData } from "@/lib/agenda/queries";
import { agendaViews } from "@/lib/agenda/types";
import {
  formatDate,
  formatPeriodLabel,
  formatTime,
  getAdjacentDate,
  getAgendaHref,
} from "@/lib/agenda/utils";

export default async function AgendaPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; view?: string }>;
}>) {
  const { locale } = await params;
  const {
    organization,
    today,
    selectedDate,
    view,
    appointments,
    groupedAppointments,
  } = await getAgendaPageData(await searchParams);
  const t = await getTranslations({ locale, namespace: "DailyAgenda" });

  return (
    <section className="grid gap-6">
      <Card>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">
          {t("eyebrow")}
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-4xl font-black leading-none tracking-tight">
            {t(`titles.${view}`)}
          </h1>
          <div className="flex flex-wrap gap-2">
            {agendaViews.map((agendaView) => (
              <Link
                className={[
                  "rounded-button border px-4 py-2 text-sm font-bold",
                  view === agendaView
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-foreground hover:border-primary hover:bg-primary-light",
                ].join(" ")}
                href={getAgendaHref(locale, agendaView, selectedDate)}
                key={agendaView}
              >
                {t(`views.${agendaView}`)}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-4 text-lg leading-8 text-muted">{t("description")}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-black">
            {formatPeriodLabel(view, selectedDate, locale)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-button border border-border px-4 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light"
              href={getAgendaHref(
                locale,
                view,
                getAdjacentDate(view, selectedDate, -1),
              )}
            >
              {t("previous")}
            </Link>
            <Link
              className="rounded-button border border-border px-4 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light"
              href={getAgendaHref(locale, view, today)}
            >
              {t("today")}
            </Link>
            <Link
              className="rounded-button border border-border px-4 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light"
              href={getAgendaHref(
                locale,
                view,
                getAdjacentDate(view, selectedDate, 1),
              )}
            >
              {t("next")}
            </Link>
          </div>
        </div>
      </Card>

      {appointments.length > 0 ? (
        view === "daily" ? (
          <div className="grid gap-4">
            {appointments.map((appointment) => {
              const appointmentTime =
                appointment.confirmed_start_at ??
                appointment.requested_start_at;
              const technicians = appointment.appointment_technicians
                .map((assignment) => assignment.technicians.name)
                .join(", ");

              return (
                <Link
                  className="block rounded-card bg-surface-elevated p-5 shadow-sm ring-1 ring-border transition hover:ring-primary"
                  href={`/${locale}/dashboard/appointments/${appointment.id}`}
                  key={appointment.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-2xl font-black">
                        {formatTime(
                          appointmentTime,
                          locale,
                          organization.timezone,
                        )}
                      </p>
                      <h2 className="mt-3 text-xl font-black">
                        {appointment.clients.name}
                      </h2>
                      <p className="mt-2 text-sm font-semibold text-muted">
                        {appointment.services.name}
                      </p>
                    </div>
                    <span className="w-fit rounded-button bg-primary-light px-4 py-2 text-xs font-black uppercase tracking-wide text-primary">
                      {t(`statuses.${appointment.status}`)}
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-muted">{t("address")}</dt>
                      <dd className="mt-1 font-semibold">
                        {appointment.address}, {appointment.city}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-muted">
                        {t("technicians")}
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {technicians || t("unassigned")}
                      </dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4">
            {groupedAppointments.map(
              ({ date, appointments: dayAppointments }) => (
                <section
                  className="rounded-card bg-surface-elevated p-5 shadow-sm ring-1 ring-border"
                  key={date}
                >
                  <h2 className="text-lg font-black">
                    {formatDate(date, locale)}
                  </h2>
                  <div className="mt-4 grid gap-3">
                    {dayAppointments.map((appointment) => {
                      const appointmentTime =
                        appointment.confirmed_start_at ??
                        appointment.requested_start_at;

                      return (
                        <Link
                          className="flex flex-col gap-2 rounded-2xl bg-surface p-4 transition hover:bg-primary-light sm:flex-row sm:items-center sm:justify-between"
                          href={`/${locale}/dashboard/appointments/${appointment.id}`}
                          key={appointment.id}
                        >
                          <div>
                            <p className="text-sm font-black">
                              {formatTime(
                                appointmentTime,
                                locale,
                                organization.timezone,
                              )}{" "}
                              · {appointment.clients.name}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              {appointment.services.name}
                            </p>
                          </div>
                          <span className="w-fit rounded-button bg-surface-elevated px-3 py-1 text-xs font-black uppercase tracking-wide text-primary ring-1 ring-ring-focus">
                            {t(`statuses.${appointment.status}`)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>
        )
      ) : (
        <Card className="text-center">
          <h2 className="text-2xl font-black">{t("emptyTitle")}</h2>
          <p className="mt-3 text-muted">{t("emptyDescription")}</p>
        </Card>
      )}
    </section>
  );
}
