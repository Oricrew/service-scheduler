import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui";
import { getUserRole, hasMinimumRole } from "@/lib/auth";
import { durationPresets } from "@/lib/appointments/constants";
import { canAssignStatus, canConfirmStatus } from "@/lib/appointments/status";
import {
  isAssignSuccess,
  isConfirmSuccess,
  isSchedulingConflict,
} from "@/lib/appointments/success-query";
import { getAppointmentDetailPageData } from "@/lib/appointments/queries";
import { getAppointmentSchedulingWindow } from "@/lib/scheduling/appointment-window";
import { getBusyTechnicianIds } from "@/lib/scheduling/conflicts";
import { buildWhatsappUrl } from "@/lib/whatsapp";

import {
  assignTechnicians,
  confirmAppointment,
  removeTechnician,
  updateEstimatedDuration,
} from "./actions";
import { SubmitButton } from "./submit-button";

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
  searchParams: Promise<{
    confirmed?: string;
    assigned?: string;
    conflict?: string;
  }>;
}>) {
  const { locale, id } = await params;
  const { confirmed, assigned, conflict } = await searchParams;
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
  const backHref = canManageAppointment
    ? `/${locale}/dashboard/requests`
    : `/${locale}/dashboard/agenda`;
  const backLabel = canManageAppointment
    ? t("backToRequests")
    : t("backToAgenda");
  const effectiveDurationMinutes =
    appointment.estimated_duration_minutes ??
    appointment.services.default_duration_minutes;
  const schedulingWindow = canEditAssignments
    ? getAppointmentSchedulingWindow(appointment)
    : null;
  const busyTechnicianIds = schedulingWindow
    ? await getBusyTechnicianIds({
        organizationId: organization.id,
        appointmentId: appointment.id,
        technicianIds: activeTechnicians.map((technician) => technician.id),
        startAt: schedulingWindow.startAt,
        durationMinutes: schedulingWindow.durationMinutes,
        travelBufferMinutes: schedulingWindow.travelBufferMinutes,
      })
    : new Set<string>();
  const availableTechnicians = canEditAssignments
    ? activeTechnicians.filter(
        (technician) => !assignedTechnicianIds.has(technician.id),
      )
    : [];
  const allTechniciansAssigned =
    canEditAssignments &&
    activeTechnicians.length > 0 &&
    availableTechnicians.length === 0;
  const whatsappUrl = buildWhatsappUrl({
    phone: appointment.clients.phone,
    message: t("whatsappMessage", {
      clientName: appointment.clients.name,
      serviceName: appointment.services.name,
    }),
  });

  return (
    <section className="grid gap-6">
      {isConfirmSuccess(confirmed) ? (
        <p className="rounded-card bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
          {t("confirmedSuccess")}
        </p>
      ) : null}
      {isAssignSuccess(assigned) ? (
        <p className="rounded-card bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">
          {t("assignedSuccess")}
        </p>
      ) : null}
      {isSchedulingConflict(conflict) ? (
        <p className="rounded-card bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-900 ring-1 ring-rose-200">
          {t("schedulingConflict")}
        </p>
      ) : null}

      <Card>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">
          {t("eyebrow")}
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-black leading-none tracking-tight">
              {appointment.clients.name}
            </h1>
            <p className="mt-3 text-lg font-semibold text-muted">
              {appointment.services.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {appointment.services.is_emergency ? (
              <span className="w-fit rounded-button bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-rose-800">
                {t("emergency")}
              </span>
            ) : null}
            <span className="w-fit rounded-button bg-primary-light px-4 py-2 text-xs font-black uppercase tracking-wide text-primary">
              {t(`statuses.${appointment.status}`)}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-muted">{t("requestedAt")}</dt>
            <dd className="mt-1 font-semibold">
              {formatDateTime(appointmentTime, locale, organization.timezone)}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted">{t("submittedAt")}</dt>
            <dd className="mt-1 font-semibold">
              {formatDateTime(
                appointment.created_at,
                locale,
                organization.timezone,
              )}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted">{t("phone")}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 font-semibold">
              <span>{appointment.clients.phone}</span>
              <a
                className="rounded-button bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100"
                href={whatsappUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t("whatsappClient")}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted">{t("email")}</dt>
            <dd className="mt-1 font-semibold">{appointment.clients.email}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-muted">{t("address")}</dt>
            <dd className="mt-1 font-semibold">
              {appointment.address}, {appointment.city}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted">{t("equipment")}</dt>
            <dd className="mt-1 font-semibold">
              {appointment.equipment_type}
              {appointment.brand_model ? ` · ${appointment.brand_model}` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted">{t("estimatedDuration")}</dt>
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
                      <SubmitButton
                        aria-pressed={effectiveDurationMinutes === minutes}
                        className={
                          effectiveDurationMinutes === minutes
                            ? "rounded-button bg-primary-light px-4 py-2 text-sm font-bold text-primary ring-2 ring-primary disabled:cursor-not-allowed disabled:opacity-70"
                            : "rounded-button border border-border px-4 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted"
                        }
                        pendingChildren={t("durationPreset", { minutes })}
                      >
                        {t("durationPreset", { minutes })}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              ) : (
                <span className="font-semibold">
                  {t("durationPreset", { minutes: effectiveDurationMinutes })}
                </span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-bold text-muted">{t("problem")}</dt>
            <dd className="mt-1 leading-6 text-muted">
              {appointment.problem_description}
            </dd>
          </div>
          {canAssignStatus(appointment.status) ? (
            <div className="sm:col-span-2">
              <dt className="font-bold text-muted">{t("technicians")}</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {appointment.appointment_technicians.length > 0 ? (
                  appointment.appointment_technicians.map((assignment) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-button bg-primary-light px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-ring-focus"
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
                          <SubmitButton
                            aria-label={t("removeTechnician", {
                              name: assignment.technicians.name,
                            })}
                            className="rounded-button px-1 text-primary hover:bg-primary-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            pendingChildren="×"
                          >
                            ×
                          </SubmitButton>
                        </form>
                      ) : null}
                    </span>
                  ))
                ) : (
                  <span className="font-semibold">{t("unassigned")}</span>
                )}
              </dd>
            </div>
          ) : null}
          {appointment.client_notes ? (
            <div className="sm:col-span-2">
              <dt className="font-bold text-muted">{t("notes")}</dt>
              <dd className="mt-1 leading-6 text-muted">
                {appointment.client_notes}
              </dd>
            </div>
          ) : null}
        </dl>

        {canEditAssignments ? (
          <div className="mt-8 border-t border-border pt-8">
            <h2 className="text-lg font-black">{t("assignTechnicians")}</h2>
            {activeTechnicians.length > 0 ? (
              allTechniciansAssigned ? (
                <p className="mt-3 text-sm font-semibold text-muted">
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
                  {availableTechnicians.map((technician) => {
                    const isBusy = busyTechnicianIds.has(technician.id);

                    return (
                      <label
                        className={
                          isBusy
                            ? "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-muted"
                            : "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-foreground"
                        }
                        key={technician.id}
                      >
                        <input
                          className="size-4 rounded border-border"
                          disabled={!canManageAppointment || isBusy}
                          name="technicianIds"
                          type="checkbox"
                          value={technician.id}
                        />
                        <span>
                          {technician.name}
                          {isBusy ? (
                            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-rose-600">
                              {t("technicianUnavailable")}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                  <div className="flex flex-col gap-2">
                    <SubmitButton
                      className="w-fit rounded-button bg-foreground px-6 py-3 text-sm font-black text-surface-elevated shadow-sm hover:bg-foreground/85 disabled:cursor-not-allowed disabled:bg-muted disabled:hover:bg-muted"
                      disabled={!canManageAppointment}
                      pendingChildren={`${t("saveAssignments")}...`}
                    >
                      {t("saveAssignments")}
                    </SubmitButton>
                  </div>
                </form>
              )
            ) : (
              <p className="mt-3 text-sm font-semibold text-muted">
                {t("noTechniciansAvailable")}
              </p>
            )}
          </div>
        ) : !canAssignStatus(appointment.status) ? (
          <div className="mt-8 border-t border-border pt-8">
            <p className="text-sm font-bold text-muted">{t("technicians")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {appointment.appointment_technicians.length > 0 ? (
                appointment.appointment_technicians.map((assignment) => (
                  <span
                    className="inline-flex items-center rounded-button bg-primary-light px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-ring-focus"
                    key={assignment.technician_id}
                  >
                    {assignment.technicians.name}
                  </span>
                ))
              ) : (
                <span className="text-sm font-semibold">{t("unassigned")}</span>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-8">
          {canManageAppointment && canConfirmStatus(appointment.status) ? (
            <div className="flex flex-col gap-2">
              <form action={confirmWithLocale}>
                <SubmitButton
                  className="rounded-button bg-foreground px-6 py-3 text-sm font-black text-surface-elevated shadow-sm hover:bg-foreground/85 disabled:cursor-not-allowed disabled:bg-muted disabled:hover:bg-muted"
                  disabled={!canManageAppointment}
                  pendingChildren={`${t("confirm")}...`}
                >
                  {t("confirm")}
                </SubmitButton>
              </form>
            </div>
          ) : null}
          <Link
            className="inline-flex w-fit rounded-button border border-border px-5 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light"
            href={backHref}
          >
            {backLabel}
          </Link>
        </div>
      </Card>
    </section>
  );
}
