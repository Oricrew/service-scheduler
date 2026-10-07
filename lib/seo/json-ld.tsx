import { getTranslations } from "next-intl/server";

import { seoOgImagePath, seoOrganizationId } from "@/lib/seo/site";
import { absoluteUrl } from "@/lib/seo/urls";

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
  const organizationUrl = t(`organizations.${seoOrganizationId}.url`);
  const logoUrl = absoluteUrl(seoOgImagePath);

  const organization: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: t(`organizations.${seoOrganizationId}.name`),
    url: organizationUrl,
    logo: logoUrl,
    email: t(`organizations.${seoOrganizationId}.email`),
  };

  const service: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t("services.fieldScheduling.name"),
    description: t("services.fieldScheduling.description"),
    provider: {
      "@type": "Organization",
      name: t(`organizations.${seoOrganizationId}.name`),
      url: organizationUrl,
    },
    areaServed: t("services.fieldScheduling.areaServed"),
    serviceType: t("services.fieldScheduling.serviceType"),
  };

  return [organization, service];
}
