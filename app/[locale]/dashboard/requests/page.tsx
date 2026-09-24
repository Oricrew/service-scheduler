import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardHeader } from "@/components/ui";
import { getPendingRequestsPageData } from "@/lib/requests/queries";

function formatRequestedAt(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function RequestsPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const { organization, requests } = await getPendingRequestsPageData();
  const t = await getTranslations({ locale, namespace: "PendingRequests" });

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          titleAs="h1"
          description={t("description")}
        />
      </Card>

      {requests.length > 0 ? (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Link
              className="rounded-card bg-surface-elevated p-5 shadow-sm ring-1 ring-border transition hover:ring-primary"
              href={`/${locale}/dashboard/appointments/${request.id}`}
              key={request.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-2xl font-black">
                    {formatRequestedAt(
                      request.requested_start_at,
                      locale,
                      organization.timezone,
                    )}
                  </p>
                  <h2 className="mt-3 text-xl font-black">
                    {request.clients.name}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-muted">
                    {request.services.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.services.is_emergency ? (
                    <span className="w-fit rounded-button bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-rose-800">
                      {t("emergency")}
                    </span>
                  ) : null}
                  <span className="w-fit rounded-button bg-primary-light px-4 py-2 text-xs font-black uppercase tracking-wide text-primary">
                    {t(`statuses.${request.status}`)}
                  </span>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-muted">{t("address")}</dt>
                  <dd className="mt-1 font-semibold">
                    {request.address}, {request.city}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-muted">{t("equipment")}</dt>
                  <dd className="mt-1 font-semibold">
                    {request.equipment_type}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-center">
          <h2 className="text-2xl font-black">{t("emptyTitle")}</h2>
          <p className="mt-3 text-muted">{t("emptyDescription")}</p>
        </Card>
      )}
    </section>
  );
}
