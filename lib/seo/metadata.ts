import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { seoOgImagePath } from "@/lib/seo/site";
import { canonicalUrl, getSiteUrl, localeAlternates } from "@/lib/seo/urls";

export const privatePageRobots: Metadata["robots"] = {
  index: false,
  follow: false,
};

export const seoPageIds = [
  "home",
  "book",
  "bookConfirmation",
  "clientShowcase",
  "login",
] as const;

export type SeoPageId = (typeof seoPageIds)[number];

type CreatePageMetadataOptions = {
  locale: string;
  path: string;
  pageId: SeoPageId;
  values?: Record<string, string>;
  robots?: Metadata["robots"];
};

export async function createPageMetadata({
  locale,
  path,
  pageId,
  values,
  robots,
}: CreatePageMetadataOptions): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Seo" });
  const title = values
    ? t(`pages.${pageId}.title`, values)
    : t(`pages.${pageId}.title`);
  const description = values
    ? t(`pages.${pageId}.description`, values)
    : t(`pages.${pageId}.description`);
  const siteName = t("siteName");
  const ogImageUrl = new URL(seoOgImagePath, getSiteUrl()).toString();

  return {
    metadataBase: getSiteUrl(),
    title,
    description,
    alternates: {
      canonical: canonicalUrl(locale, path),
      languages: localeAlternates(path),
    },
    openGraph: {
      type: "website",
      locale,
      url: canonicalUrl(locale, path),
      siteName,
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    robots,
  };
}
