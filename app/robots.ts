import type { MetadataRoute } from "next";

import { createRobots } from "@/lib/seo/robots";

export default function robots(): MetadataRoute.Robots {
  return createRobots();
}
