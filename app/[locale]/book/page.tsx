import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { routing } from "@/i18n/routing";

import { createAppointmentRequest } from "./actions";
import { BookingForm } from "./booking-form";

type Locale = (typeof routing.locales)[number];

const serviceTypes = [
  "repair",
  "maintenance",
  "installation",
  "quotationInspection",
  "emergencyService",
] as const;

const fields = [
  "name",
  "phone",
  "email",
  "address",
  "city",
  "equipmentType",
  "problemDescription",
  "brandModel",
  "clientNotes",
] as const;

export default async function BookPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: "Book" });
  const createAppointmentRequestWithLocale = createAppointmentRequest.bind(
    null,
    currentLocale,
  );
  const formCopy = {
    required: t("required"),
    optional: t("optional"),
    cta: t("cta"),
    ctaNote: t("ctaNote"),
    reviewNotice: t("reviewNotice"),
    serviceType: {
      label: t("serviceType.label"),
      description: t("serviceType.description"),
      options: Object.fromEntries(
        serviceTypes.map((serviceType) => [
          serviceType,
          {
            value: t(`serviceType.options.${serviceType}.value`),
            label: t(`serviceType.options.${serviceType}.label`),
            description: t(`serviceType.options.${serviceType}.description`),
          },
        ]),
      ) as Record<
        (typeof serviceTypes)[number],
        { value: string; label: string; description: string }
      >,
    },
    timeSelection: {
      label: t("timeSelection.label"),
      description: t("timeSelection.description"),
      dateLabel: t("timeSelection.dateLabel"),
      slotLabel: t("timeSelection.slotLabel"),
      requiredLabel: t("required"),
      noSlotsLabel: t("timeSelection.noSlots"),
      helperText: t("timeSelection.helperText"),
    },
    fields: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          label: t(`fields.${field}.label`),
          placeholder: t(`fields.${field}.placeholder`),
        },
      ]),
    ) as Record<
      (typeof fields)[number],
      { label: string; placeholder: string }
    >,
    errors: {
      invalidDateTime: t("errors.invalidDateTime"),
    },
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          className="text-base font-black tracking-tight sm:text-lg"
          href={`/${currentLocale}`}
        >
          {t("brand")}
        </Link>
        <LanguageSwitcher currentLocale={currentLocale} />
      </header>

      <section className="mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-sky-700">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {t("description")}
          </p>
        </div>

        <BookingForm
          action={createAppointmentRequestWithLocale}
          copy={formCopy}
        />
      </section>
    </main>
  );
}
