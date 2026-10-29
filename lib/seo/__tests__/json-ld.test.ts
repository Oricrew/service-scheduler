import { describe, expect, it } from "vitest";

import { buildOrganizationJsonLd } from "@/lib/seo/json-ld";
import { seoBrandName } from "@/lib/seo/site";

describe("buildOrganizationJsonLd", () => {
  it("includes a branded Organization graph with logo and empty sameAs", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oricrew.com";

    expect(buildOrganizationJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: seoBrandName,
      url: "https://oricrew.com",
      logo: "https://oricrew.com/brand/oricrew-mark.png",
      sameAs: [],
    });
  });
});
