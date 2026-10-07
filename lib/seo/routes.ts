import type { ClientId } from "@/lib/clients";
import { clients } from "@/lib/clients";

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

export type PrivateRoutePrefix = (typeof privateRoutePrefixes)[number];

export const clientCaseStudyPathById: Record<ClientId, string> = {
  refrigo: "/refrigo",
};

export const flagshipCaseStudyPageIds = ["refrigoCaseStudy"] as const;

export type FlagshipCaseStudyPageId = (typeof flagshipCaseStudyPageIds)[number];

export const flagshipCaseStudyPaths: Record<FlagshipCaseStudyPageId, string> = {
  refrigoCaseStudy: clientCaseStudyPathById.refrigo,
};

export const publicClientShowcaseIds = clients.map((client) => client.id);
