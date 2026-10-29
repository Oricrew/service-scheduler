import { getTranslations } from "next-intl/server";

import { seoBrandName, seoLogoPath } from "@/lib/seo/site";
import { absoluteUrl, getSiteUrl } from "@/lib/seo/urls";

type JsonLdGraph = Record<string, unknown>;

type JsonLdProps = {
  data: JsonLdGraph | JsonLdGraph[];
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      type="application/ld+json"
    />
  );
}

export function buildOrganizationJsonLd(): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seoBrandName,
    url: getSiteUrl().origin,
    logo: absoluteUrl(seoLogoPath),
    sameAs: [],
  };
}

export async function getHomeJsonLd(locale: string) {
  const t = await getTranslations({ locale, namespace: "Seo" });
  const organizationUrl = getSiteUrl().origin;
  const organization = buildOrganizationJsonLd();

  const service: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t("services.fieldScheduling.name"),
    description: t("services.fieldScheduling.description"),
    provider: {
      "@type": "Organization",
      name: seoBrandName,
      url: organizationUrl,
    },
    areaServed: t("services.fieldScheduling.areaServed"),
    serviceType: t("services.fieldScheduling.serviceType"),
  };

  return [organization, service];
}
