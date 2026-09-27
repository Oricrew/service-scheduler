import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

function isClientZonePath(pathname: string) {
  const clientPath = process.env.CLIENT_PATH?.trim();

  if (!clientPath) {
    return false;
  }

  return (
    pathname === `/${clientPath}` || pathname.startsWith(`/${clientPath}/`)
  );
}

export default async function proxy(request: NextRequest) {
  if (isClientZonePath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = handleI18nRouting(request);
  const supabase = createSupabaseMiddlewareClient(request, response);

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
