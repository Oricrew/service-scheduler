import { useTranslations } from "next-intl";

import { PageShell } from "@/components/page-shell";

export default function Home() {
  const t = useTranslations("Home");

  return (
    <PageShell centered>
      <section>
        <p className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-600">
          {t("eyebrow")}
        </p>
        <h1 className="text-4xl font-bold leading-none sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          {t("description")}
        </p>
      </section>
    </PageShell>
  );
}
