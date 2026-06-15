import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];

const benefits = ["booking", "approval", "mobile"] as const;
const steps = ["request", "review", "visit"] as const;

export default async function Home({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: "Home" });
  const bookHref = `/${currentLocale}/book`;
  const dashboardHref = `/${currentLocale}/dashboard`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          className="text-base font-black tracking-tight sm:text-lg"
          href={`/${currentLocale}`}
        >
          {t("brand")}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher currentLocale={currentLocale} />
          <Link
            className="hidden rounded-full px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-white sm:inline-flex"
            href={dashboardHref}
          >
            {t("nav.login")}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        <div>
          <p className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-sky-700">
            {t("eyebrow")}
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-none tracking-tight sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded-full bg-slate-950 px-6 py-3 text-center text-sm font-black text-white shadow-sm hover:bg-slate-800"
              href={bookHref}
            >
              {t("cta.book")}
            </Link>
            <Link
              className="rounded-full bg-white px-6 py-3 text-center text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
              href={dashboardHref}
            >
              {t("cta.login")}
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200/80 ring-1 ring-slate-200">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-sm font-bold text-sky-200">
              {t("preview.badge")}
            </p>
            <h2 className="mt-3 text-2xl font-black">{t("preview.title")}</h2>
            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">
                  {t("preview.clientLabel")}
                </p>
                <p className="mt-1 font-bold">{t("preview.client")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-slate-300">
                    {t("preview.timeLabel")}
                  </p>
                  <p className="mt-1 font-bold">{t("preview.time")}</p>
                </div>
                <div className="rounded-2xl bg-sky-400 p-4 text-slate-950">
                  <p className="text-sm font-bold">
                    {t("preview.statusLabel")}
                  </p>
                  <p className="mt-1 font-black">{t("preview.status")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-8 sm:px-8 md:grid-cols-3">
        {benefits.map((benefit) => (
          <article
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            key={benefit}
          >
            <h2 className="text-xl font-black">
              {t(`benefits.${benefit}.title`)}
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              {t(`benefits.${benefit}.description`)}
            </p>
          </article>
        ))}
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div className="rounded-[2rem] bg-slate-900 p-6 text-white sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-300">
            {t("workflow.eyebrow")}
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400 font-black text-slate-950">
                  {index + 1}
                </span>
                <h2 className="mt-4 text-xl font-black">
                  {t(`workflow.${step}.title`)}
                </h2>
                <p className="mt-3 leading-7 text-slate-300">
                  {t(`workflow.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-4 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">
            {t("final.title")}
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            {t("final.description")}
          </p>
        </div>
        <Link
          className="rounded-full bg-sky-500 px-6 py-3 text-center text-sm font-black text-slate-950 shadow-sm hover:bg-sky-400"
          href={bookHref}
        >
          {t("final.cta")}
        </Link>
      </section>
    </main>
  );
}
