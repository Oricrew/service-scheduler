import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { signOut } from "../login/actions";

type Locale = (typeof routing.locales)[number];

const navItems = [
  { key: "home", href: "/dashboard" },
  { key: "agenda", href: "/dashboard/agenda" },
  { key: "requests", href: "/dashboard/requests" },
  { key: "settings", href: "/dashboard/settings" },
] as const;

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  const signOutWithLocale = signOut.bind(null, currentLocale);
  const t = await getTranslations({ locale, namespace: "DashboardShell" });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <main className="min-h-screen bg-surface text-foreground">
      <header className="border-b border-border bg-surface-elevated">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="text-base font-black tracking-tight sm:text-lg"
              href={`/${currentLocale}/dashboard`}
            >
              {t("brand")}
            </Link>
            <p className="mt-1 text-sm font-semibold text-muted">
              {t("subtitle")}
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                className="rounded-button border border-border px-4 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light hover:text-primary"
                href={`/${currentLocale}${item.href}`}
                key={item.href}
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher currentLocale={currentLocale} />
            <form action={signOutWithLocale}>
              <Button type="submit" size="sm">
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </section>
    </main>
  );
}
