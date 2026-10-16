import { describe, expect, it } from "vitest";

import { canonicalUrl, localizedPath } from "@/lib/seo/urls";

describe("seo urls", () => {
  it("builds localized paths", () => {
    expect(localizedPath("es", "")).toBe("/es");
    expect(localizedPath("en", "book")).toBe("/en/book");
  });

  it("builds canonical urls from NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oricrew.com/";
    expect(canonicalUrl("es", "book")).toBe("https://oricrew.com/es/book");
  });
});
