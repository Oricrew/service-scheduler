import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];

const requiredFields = [
  "name",
  "phone",
  "email",
  "address",
  "city",
  "equipmentType",
  "problemDescription",
] as const;

const optionalFields = ["brandModel", "clientNotes"] as const;

const inputTypes: Partial<Record<(typeof requiredFields)[number], string>> = {
  email: "email",
  phone: "tel",
};

export default async function BookPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: "Book" });

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

        <form className="mt-10 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            {requiredFields.map((field) => (
              <label
                className={[
                  "grid gap-2",
                  field === "problemDescription" ? "md:col-span-2" : "",
                ].join(" ")}
                key={field}
              >
                <span className="text-sm font-bold text-slate-800">
                  {t(`fields.${field}.label`)}
                  <span className="ml-1 text-sky-700">{t("required")}</span>
                </span>
                {field === "problemDescription" ? (
                  <textarea
                    className="min-h-32 rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    name={field}
                    placeholder={t(`fields.${field}.placeholder`)}
                    required
                  />
                ) : (
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    name={field}
                    placeholder={t(`fields.${field}.placeholder`)}
                    required
                    type={inputTypes[field] ?? "text"}
                  />
                )}
              </label>
            ))}

            {optionalFields.map((field) => (
              <label
                className={[
                  "grid gap-2",
                  field === "clientNotes" ? "md:col-span-2" : "",
                ].join(" ")}
                key={field}
              >
                <span className="text-sm font-bold text-slate-800">
                  {t(`fields.${field}.label`)}
                  <span className="ml-1 text-slate-500">{t("optional")}</span>
                </span>
                {field === "clientNotes" ? (
                  <textarea
                    className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    name={field}
                    placeholder={t(`fields.${field}.placeholder`)}
                  />
                ) : (
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    name={field}
                    placeholder={t(`fields.${field}.placeholder`)}
                    type="text"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {t("reviewNotice")}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
              type="button"
            >
              {t("cta")}
            </button>
            <p className="text-sm leading-6 text-slate-500">{t("ctaNote")}</p>
          </div>
        </form>
      </section>
    </main>
  );
}
