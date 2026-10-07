import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo/urls";

export function createRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/*/dashboard",
        "/*/dashboard/",
        "/*/login",
        "/*/appointment/",
        "/*/book/confirmation",
      ],
    },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
