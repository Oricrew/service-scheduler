import { routing } from "@/i18n/routing";

function normalizeSiteUrl(raw: string): URL {
  const trimmed = raw.trim().replace(/\/$/, "");
  return new URL(trimmed || "https://oricrew.com");
}

export function getSiteUrl(): URL {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL ?? "");
}

export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getSiteUrl()).toString();
}

export function localizedPath(locale: string, path: string): string {
  const suffix = path ? `/${path.replace(/^\//, "")}` : "";
  return `/${locale}${suffix}`;
}

export function canonicalUrl(locale: string, path: string): string {
  return absoluteUrl(localizedPath(locale, path));
}

export function localeAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    languages[locale] = canonicalUrl(locale, path);
  }

  languages["x-default"] = canonicalUrl(routing.defaultLocale, path);

  return languages;
}
