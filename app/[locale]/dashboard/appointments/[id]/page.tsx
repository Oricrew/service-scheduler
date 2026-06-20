import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getUserRole, hasMinimumRole } from "@/lib/auth";
import { durationPresets } from "@/lib/appointments/constants";
import { canAssignStatus, canConfirmStatus } from "@/lib/appointments/status";
import {
  isAssignSuccess,
  isConfirmSuccess,
} from "@/lib/appointments/success-query";
import { getAppointmentDetailPageData } from "@/lib/appointments/queries";

import {
  assignTechnicians,
  confirmAppointment,
  removeTechnician,
  updateEstimatedDuration,
} from "./actions";

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
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ confirmed?: string; assigned?: string }>;
}>) {
  const { locale, id } = await params;
  const { confirmed, assigned } = await searchParams;
  const pageData = await getAppointmentDetailPageData(id);

  if (!pageData) {
    notFound();
  }

  const { organization, appointment, activeTechnicians } = pageData;
  const userRole = await getUserRole();
  const canManageAppointment = hasMinimumRole(userRole, "supervisor");
  const t = await getTranslations({ locale, namespace: "AppointmentDetail" });
  const confirmWithLocale = confirmAppointment.bind(null, locale, id);
  const assignWithLocale = assignTechnicians.bind(null, locale, id);
  const appointmentTime =
    appointment.confirmed_start_at ?? appointment.requested_start_at;
  const assignedTechnicianIds = new Set(
    appointment.appointment_technicians.map(
      (assignment) => assignment.technician_id,
    ),
  );
  const canEditAssignments =
    canManageAppointment && canAssignStatus(appointment.status);
  const canEditDuration = canEditAssignments;
  const effectiveDurationMinutes =
    appointment.estimated_duration_minutes ??
    appointment.services.default_duration_minutes;
  const availableTechnicians = activeTechnicians.filter(
    (technician) => !assignedTechnicianIds.has(technician.id),
  );
  const allTechniciansAssigned =
    activeTechnicians.length > 0 && availableTechnicians.length === 0;

  return (
    <section className="grid gap-6">
      {isConfirmSuccess(confirmed) ? (
        <p className="rounded-[1.75rem] bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
          {t("confirmedSuccess")}
        </p>
      ) : null}
      {isAssignSuccess(assigned) ? (
        <p className="rounded-[1.75rem] bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
          {t("assignedSuccess")}
        </p>
      ) : null}

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
            <dt className="font-bold text-slate-500">
              {t("estimatedDuration")}
            </dt>
            <dd className="mt-2">
              {canEditDuration ? (
                <div className="flex flex-wrap gap-2">
                  {durationPresets.map((minutes) => (
                    <form
                      action={updateEstimatedDuration.bind(
                        null,
                        locale,
                        id,
                        minutes,
                      )}
                      className="inline-flex"
                      key={minutes}
                    >
                      <button
                        aria-pressed={effectiveDurationMinutes === minutes}
                        className={
                          effectiveDurationMinutes === minutes
                            ? "rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 ring-2 ring-sky-300"
                            : "rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }
                        type="submit"
                      >
                        {t("durationPreset", { minutes })}
                      </button>
                    </form>
                  ))}
                </div>
              ) : (
                <span className="font-semibold text-slate-950">
                  {t("durationPreset", { minutes: effectiveDurationMinutes })}
                </span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">{t("problem")}</dt>
            <dd className="mt-1 leading-6 text-slate-700">
              {appointment.problem_description}
            </dd>
          </div>
          {canAssignStatus(appointment.status) ? (
            <div className="sm:col-span-2">
              <dt className="font-bold text-slate-500">{t("technicians")}</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {appointment.appointment_technicians.length > 0 ? (
                  appointment.appointment_technicians.map((assignment) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 ring-1 ring-sky-100"
                      key={assignment.technician_id}
                    >
                      {assignment.technicians.name}
                      {canEditAssignments ? (
                        <form
                          action={removeTechnician.bind(
                            null,
                            locale,
                            id,
                            assignment.technician_id,
                          )}
                          className="inline-flex"
                        >
                          <button
                            aria-label={t("removeTechnician", {
                              name: assignment.technicians.name,
                            })}
                            className="rounded-full px-1 text-sky-600 hover:bg-sky-100 hover:text-sky-900"
                            type="submit"
                          >
                            ×
                          </button>
                        </form>
                      ) : null}
                    </span>
                  ))
                ) : (
                  <span className="font-semibold text-slate-950">
                    {t("unassigned")}
                  </span>
                )}
              </dd>
            </div>
          ) : null}
          {appointment.client_notes ? (
            <div className="sm:col-span-2">
              <dt className="font-bold text-slate-500">{t("notes")}</dt>
              <dd className="mt-1 leading-6 text-slate-700">
                {appointment.client_notes}
              </dd>
            </div>
          ) : null}
        </dl>

        {canAssignStatus(appointment.status) ? (
          <div className="mt-8 border-t border-slate-200 pt-8">
            <h2 className="text-lg font-black text-slate-950">
              {t("assignTechnicians")}
            </h2>
            {activeTechnicians.length > 0 ? (
              allTechniciansAssigned ? (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  {t("allTechniciansAssigned")}
                </p>
              ) : (
                <form action={assignWithLocale} className="mt-4 grid gap-3">
                  {appointment.appointment_technicians.map((assignment) => (
                    <input
                      key={assignment.technician_id}
                      name="technicianIds"
                      type="hidden"
                      value={assignment.technician_id}
                    />
                  ))}
                  {availableTechnicians.map((technician) => (
                    <label
                      className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                      key={technician.id}
                    >
                      <input
                        className="size-4 rounded border-slate-300"
                        disabled={!canManageAppointment}
                        name="technicianIds"
                        type="checkbox"
                        value={technician.id}
                      />
                      {technician.name}
                    </label>
                  ))}
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-fit rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
                      disabled={!canManageAppointment}
                      type="submit"
                    >
                      {t("saveAssignments")}
                    </button>
                    {!canManageAppointment ? (
                      <p className="text-sm font-semibold text-slate-500">
                        {t("assignRequiresSupervisor")}
                      </p>
                    ) : null}
                  </div>
                </form>
              )
            ) : (
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {t("noTechniciansAvailable")}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-8 border-t border-slate-200 pt-8">
            <p className="text-sm font-bold text-slate-500">
              {t("technicians")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {appointment.appointment_technicians.length > 0 ? (
                appointment.appointment_technicians.map((assignment) => (
                  <span
                    className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 ring-1 ring-sky-100"
                    key={assignment.technician_id}
                  >
                    {assignment.technicians.name}
                  </span>
                ))
              ) : (
                <span className="text-sm font-semibold text-slate-950">
                  {t("unassigned")}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-8">
          {canConfirmStatus(appointment.status) ? (
            <div className="flex flex-col gap-2">
              <form action={confirmWithLocale}>
                <button
                  className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
                  disabled={!canManageAppointment}
                  type="submit"
                >
                  {t("confirm")}
                </button>
              </form>
              {!canManageAppointment ? (
                <p className="text-sm font-semibold text-slate-500">
                  {t("confirmRequiresSupervisor")}
                </p>
              ) : null}
            </div>
          ) : null}
          <Link
            className="inline-flex w-fit rounded-full border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
            href={`/${locale}/dashboard/requests`}
          >
            {t("backToRequests")}
          </Link>
        </div>
      </div>
    </section>
  );
}
