import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { routing } from "@/i18n/routing";
import { clients, getClient } from "@/lib/clients";

import styles from "./client-theme.module.css";

type Locale = (typeof routing.locales)[number];

const benefits = ["booking", "approval", "mobile"] as const;
const steps = ["request", "review", "visit"] as const;

export function generateStaticParams() {
  return clients.map((c) => ({ clientId: c.id }));
}

export default async function ClientShowcase({
  params,
}: Readonly<{
  params: Promise<{ locale: string; clientId: string }>;
}>) {
  const { locale, clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  const currentLocale = locale as Locale;
  const t = await getTranslations({
    locale,
    namespace: `ClientShowcase.${clientId}`,
  });
  const tc = await getTranslations({ locale, namespace: "Clients" });
  const bookHref = `/${currentLocale}/book`;
  const dashboardHref = `/${currentLocale}/dashboard`;

  const logoWidth = Math.round(36 * (client.logo.width / client.logo.height));

  const themeVars = {
    "--client-primary": client.theme.primary,
    "--client-primary-hover": client.theme.primaryHover,
    "--client-primary-light": client.theme.primaryLight,
    "--client-secondary": client.theme.secondary,
    "--client-secondary-light": client.theme.secondaryLight,
  } as React.CSSProperties;

  return (
    <main
      className={`min-h-screen bg-slate-50 text-slate-950 ${styles.theme}`}
      style={themeVars}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          className="flex items-center gap-3"
          href={`/${currentLocale}/${clientId}`}
        >
          <Image
            alt={tc(`${clientId}.name`)}
            height={36}
            priority
            src={client.logo.src}
            width={logoWidth}
          />
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
          <p
            className={`mb-4 text-sm font-black uppercase tracking-[0.22em] ${styles.eyebrow}`}
          >
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
              className={`rounded-full px-6 py-3 text-center text-sm font-black shadow-sm ${styles.ctaPrimary}`}
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
          <div
            className={`rounded-[1.5rem] p-5 text-white ${styles.previewCard}`}
          >
            <p className={`text-sm font-bold ${styles.previewBadge}`}>
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
                <div className={`rounded-2xl p-4 ${styles.previewAccent}`}>
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
        <div
          className={`rounded-[2rem] p-6 text-white sm:p-10 ${styles.workflowBg}`}
        >
          <p
            className={`text-sm font-black uppercase tracking-[0.22em] ${styles.workflowEyebrow}`}
          >
            {t("workflow.eyebrow")}
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step}>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${styles.stepBadge}`}
                >
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
          className={`rounded-full px-6 py-3 text-center text-sm font-black shadow-sm ${styles.finalCta}`}
          href={bookHref}
        >
          {t("final.cta")}
        </Link>
      </section>
    </main>
  );
}
