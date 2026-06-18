import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { requireAuthOrRedirect } from "@/lib/auth";

import { signOut } from "../login/actions";

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
  const signOutWithLocale = signOut.bind(null, locale);
  const t = await getTranslations({ locale, namespace: "DashboardShell" });
  await requireAuthOrRedirect(locale);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="text-base font-black tracking-tight sm:text-lg"
              href={`/${locale}/dashboard`}
            >
              {t("brand")}
            </Link>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {t("subtitle")}
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                href={`/${locale}${item.href}`}
                key={item.href}
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>

          <form action={signOutWithLocale}>
            <button
              className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800"
              type="submit"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </section>
    </main>
  );
}
