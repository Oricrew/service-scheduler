import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { seoOgImagePath } from "@/lib/seo/site";
import {
  absoluteUrl,
  canonicalUrl,
  getSiteUrl,
  localeAlternates,
} from "@/lib/seo/urls";

export const privatePageRobots: Metadata["robots"] = {
  index: false,
  follow: false,
};

export type SeoPageId =
  | "home"
  | "book"
  | "bookConfirmation"
  | "clientShowcase"
  | "login";

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
  const title = t(`pages.${pageId}.title`, values);
  const description = t(`pages.${pageId}.description`, values);
  const siteName = t("siteName");
  const ogImageUrl = absoluteUrl(seoOgImagePath);

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

type StaticPageMetadataDefinition = {
  pageId: SeoPageId;
  path: string;
  robots?: Metadata["robots"];
};

type DynamicPageMetadataDefinition = {
  pageId: SeoPageId;
  robots?: Metadata["robots"];
  resolve: (input: {
    locale: string;
    params: Record<string, string>;
  }) => Promise<{ path: string; values?: Record<string, string> } | null>;
};

type PageMetadataDefinition =
  | StaticPageMetadataDefinition
  | DynamicPageMetadataDefinition;

export function pageMetadata(definition: PageMetadataDefinition) {
  return async ({
    params,
  }: Readonly<{
    params: Promise<{ locale: string } & Record<string, string>>;
  }>): Promise<Metadata> => {
    const resolved = await params;
    const { locale } = resolved;

    if ("path" in definition) {
      return createPageMetadata({
        locale,
        path: definition.path,
        pageId: definition.pageId,
        robots: definition.robots,
      });
    }

    const resolvedPage = await definition.resolve({
      locale,
      params: resolved,
    });

    if (!resolvedPage) {
      return {};
    }

    return createPageMetadata({
      locale,
      path: resolvedPage.path,
      pageId: definition.pageId,
      values: resolvedPage.values,
      robots: definition.robots,
    });
  };
}
