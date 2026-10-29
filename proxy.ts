import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

function withPermanentRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (request.nextUrl.pathname !== "/" || response.status !== 307) {
    return response;
  }

  const location = response.headers.get("Location");
  if (!location) {
    return response;
  }

  const permanent = NextResponse.redirect(location, 308);
  response.cookies.getAll().forEach((cookie) => {
    permanent.cookies.set(cookie);
  });

  return permanent;
}

function isClientZonePath(pathname: string) {
  const clientPath = process.env.CLIENT_PATH?.trim();

  if (!clientPath) {
    return false;
  }

  return (
    pathname === `/${clientPath}` || pathname.startsWith(`/${clientPath}/`)
  );
}

function isSeoMetadataPath(pathname: string) {
  return pathname === "/robots.txt" || pathname === "/sitemap.xml";
}

export default async function proxy(request: NextRequest) {
  if (
    isClientZonePath(request.nextUrl.pathname) ||
    isSeoMetadataPath(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  const response = handleI18nRouting(request);
  const supabase = createSupabaseMiddlewareClient(request, response);

  await supabase.auth.getUser();

  return withPermanentRedirect(request, response);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
