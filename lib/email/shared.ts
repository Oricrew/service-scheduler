import { Resend } from "resend";

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (!apiKey || !from || !appUrl) {
    return null;
  }

  return { apiKey, from, appUrl };
}

export function formatEmailDateTime(
  value: string,
  locale: string,
  timezone: string,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  skippedMessage: string;
  errorMessage: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    console.error(input.skippedMessage);
    return;
  }

  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      console.error(input.errorMessage, error);
    }
  } catch (error) {
    console.error(input.errorMessage, error);
  }
}

export function buildAppointmentUrl(locale: string, token: string) {
  const config = getEmailConfig();

  if (!config) {
    return null;
  }

  return `${config.appUrl}/${locale}/appointment/${token}`;
}
