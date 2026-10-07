export const publicSitemapPageIds = ["home", "book"] as const;

type PublicSitemapPageId = (typeof publicSitemapPageIds)[number];

export const publicSitemapPagePaths: Record<PublicSitemapPageId, string> = {
  home: "",
  book: "book",
};

const privateRoutePrefixes = [
  "dashboard",
  "login",
  "appointment",
  "book/confirmation",
] as const;

export function robotsDisallowPaths(): string[] {
  return ["/api/", ...privateRoutePrefixes.map((p) => `/*/${p}`)];
}
