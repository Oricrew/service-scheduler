import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { clients } from "@/lib/clients";
import {
  flagshipCaseStudyPageIds,
  flagshipCaseStudyPaths,
  publicSitemapPageIds,
  publicSitemapPagePaths,
} from "@/lib/seo/routes";
import { getSiteUrl, localizedPath } from "@/lib/seo/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const pageId of publicSitemapPageIds) {
      const path = publicSitemapPagePaths[pageId];
      entries.push({
        url: new URL(localizedPath(locale, path), siteUrl).toString(),
        lastModified,
        changeFrequency: pageId === "home" ? "weekly" : "monthly",
        priority: pageId === "home" ? 1 : 0.8,
      });
    }

    for (const client of clients) {
      entries.push({
        url: new URL(localizedPath(locale, client.id), siteUrl).toString(),
        lastModified,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  for (const caseStudyId of flagshipCaseStudyPageIds) {
    entries.push({
      url: new URL(flagshipCaseStudyPaths[caseStudyId], siteUrl).toString(),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    });
  }

  return entries;
}
