export const publicSitemapPageIds = ["home", "book"] as const;

export type PublicSitemapPageId = (typeof publicSitemapPageIds)[number];

export const publicSitemapPagePaths: Record<PublicSitemapPageId, string> = {
  home: "",
  book: "book",
};

export const privateRoutePrefixes = [
  "dashboard",
  "login",
  "appointment",
  "book/confirmation",
] as const;

export function robotsDisallowPaths(): string[] {
  return [
    "/api/",
    ...privateRoutePrefixes.flatMap((prefix) => {
      const scoped = `/*/${prefix}`;
      return prefix === "login" || prefix === "book/confirmation"
        ? [scoped]
        : [scoped, `${scoped}/`];
    }),
  ];
}
