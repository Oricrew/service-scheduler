import { getTranslations } from "next-intl/server";

import { seoContactEmail, seoOgImagePath } from "@/lib/seo/site";
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

export async function getHomeJsonLd(locale: string) {
  const t = await getTranslations({ locale, namespace: "Seo" });
  const siteName = t("siteName");
  const organizationUrl = getSiteUrl().origin;
  const logoUrl = absoluteUrl(seoOgImagePath);

  const organization: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: organizationUrl,
    logo: logoUrl,
    email: seoContactEmail,
  };

  const service: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t("services.fieldScheduling.name"),
    description: t("services.fieldScheduling.description"),
    provider: {
      "@type": "Organization",
      name: siteName,
      url: organizationUrl,
    },
    areaServed: t("services.fieldScheduling.areaServed"),
    serviceType: t("services.fieldScheduling.serviceType"),
  };

  return [organization, service];
}
