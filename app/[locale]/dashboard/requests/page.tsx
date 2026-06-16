import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
      <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-700">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-4xl font-black leading-none tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          {t("description")}
        </p>
      </div>

      {requests.length > 0 ? (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Link
              className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-sky-300"
              href={`/${locale}/dashboard/appointments/${request.id}`}
              key={request.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-2xl font-black text-slate-950">
                    {formatRequestedAt(
                      request.requested_start_at,
                      locale,
                      organization.timezone,
                    )}
                  </p>
                  <h2 className="mt-3 text-xl font-black text-slate-950">
                    {request.clients.name}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    {request.services.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.services.is_emergency ? (
                    <span className="w-fit rounded-full bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-rose-800">
                      {t("emergency")}
                    </span>
                  ) : null}
                  <span className="w-fit rounded-full bg-sky-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-sky-800">
                    {t(`statuses.${request.status}`)}
                  </span>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-slate-500">{t("address")}</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {request.address}, {request.city}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500">{t("equipment")}</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {request.equipment_type}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">
            {t("emptyTitle")}
          </h2>
          <p className="mt-3 text-slate-600">{t("emptyDescription")}</p>
        </div>
      )}
    </section>
  );
}
