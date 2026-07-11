import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  const supabase = createSupabaseMiddlewareClient(request, response);

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
