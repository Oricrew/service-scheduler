import { getTranslations } from "next-intl/server";

import { escapeHtml, formatEmailDateTime, sendEmail } from "@/lib/email/shared";

export type AppointmentReminderEmailInput = {
  locale: string;
  to: string;
  clientName: string;
  serviceName: string;
  confirmedStartAt: string;
  timezone: string;
  address: string;
  city: string;
  technicianNames: string[];
};

export async function sendAppointmentReminderEmail(
  input: AppointmentReminderEmailInput,
) {
  try {
    const t = await getTranslations({
      locale: input.locale,
      namespace: "AppointmentReminderEmail",
    });
    const formattedDateTime = formatEmailDateTime(
      input.confirmedStartAt,
      input.locale,
      input.timezone,
    );
    const fullAddress = `${input.address}, ${input.city}`;
    const technicians =
      input.technicianNames.length > 0
        ? input.technicianNames.join(", ")
        : t("unassigned");
    const greeting = t("greeting", { name: input.clientName });
    const subject = t("subject");
    const text = [
      greeting,
      "",
      t("intro"),
      "",
      `${t("service")}: ${input.serviceName}`,
      `${t("dateTime")}: ${formattedDateTime}`,
      `${t("address")}: ${fullAddress}`,
      `${t("technicians")}: ${technicians}`,
      "",
      t("footer"),
    ].join("\n");
    const html = [
      `<p>${escapeHtml(greeting)}</p>`,
      `<p>${escapeHtml(t("intro"))}</p>`,
      "<ul>",
      `<li><strong>${escapeHtml(t("service"))}:</strong> ${escapeHtml(input.serviceName)}</li>`,
      `<li><strong>${escapeHtml(t("dateTime"))}:</strong> ${escapeHtml(formattedDateTime)}</li>`,
      `<li><strong>${escapeHtml(t("address"))}:</strong> ${escapeHtml(fullAddress)}</li>`,
      `<li><strong>${escapeHtml(t("technicians"))}:</strong> ${escapeHtml(technicians)}</li>`,
      "</ul>",
      `<p>${escapeHtml(t("footer"))}</p>`,
    ].join("");

    await sendEmail({
      to: input.to,
      subject,
      text,
      html,
      skippedMessage:
        "Appointment reminder email skipped: missing RESEND_API_KEY, EMAIL_FROM, or NEXT_PUBLIC_APP_URL.",
      errorMessage: "Failed to send appointment reminder email:",
    });
  } catch (error) {
    console.error("Failed to send appointment reminder email:", error);
  }
}
