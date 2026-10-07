import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { clients } from "@/lib/clients";
import { publicSitemapPageIds, publicSitemapPagePaths } from "@/lib/seo/routes";
import { absoluteUrl, canonicalUrl } from "@/lib/seo/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const pageId of publicSitemapPageIds) {
      const path = publicSitemapPagePaths[pageId];
      entries.push({
        url: canonicalUrl(locale, path),
        lastModified,
        changeFrequency: pageId === "home" ? "weekly" : "monthly",
        priority: pageId === "home" ? 1 : 0.8,
      });
    }

    for (const client of clients) {
      entries.push({
        url: canonicalUrl(locale, client.id),
        lastModified,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  for (const client of clients) {
    if (!client.caseStudyPath) {
      continue;
    }

    entries.push({
      url: absoluteUrl(client.caseStudyPath),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    });
  }

  return entries;
}
