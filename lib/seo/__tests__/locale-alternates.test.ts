import { describe, expect, it } from "vitest";

import { localeAlternates } from "@/lib/seo/urls";

describe("localeAlternates", () => {
  it("includes es, en, pt, and x-default pointing at the default locale", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oricrew.com";

    expect(localeAlternates("book")).toEqual({
      es: "https://oricrew.com/es/book",
      en: "https://oricrew.com/en/book",
      pt: "https://oricrew.com/pt/book",
      "x-default": "https://oricrew.com/es/book",
    });
  });
});
