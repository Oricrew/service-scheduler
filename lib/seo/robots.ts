import type { MetadataRoute } from "next";

import { robotsDisallowPaths } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/urls";

export function createRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: robotsDisallowPaths(),
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
