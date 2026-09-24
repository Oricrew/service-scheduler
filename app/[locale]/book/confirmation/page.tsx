import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Card, CardHeader } from "@/components/ui";
import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];

export default async function BookingConfirmationPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: "Book" });

  return (
    <main className="min-h-screen bg-surface text-foreground">
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
        <Card>
          <CardHeader
            description={t("confirmation.description")}
            eyebrow={t("confirmation.eyebrow")}
            title={t("confirmation.title")}
            titleAs="h1"
          />
          <Link
            className="mt-6 inline-flex rounded-button bg-foreground px-6 py-3 text-sm font-black text-surface-elevated shadow-sm hover:bg-foreground/85"
            href={`/${currentLocale}`}
          >
            {t("confirmation.cta")}
          </Link>
        </Card>
      </section>
    </main>
  );
}
