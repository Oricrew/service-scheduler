import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { isAiConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { logPrefillUsage } from "@/lib/ai/usage-logger";
import { executePrefill, MAX_DESCRIPTION_LENGTH } from "@/lib/ai/prefill";

/** Hard cap on raw request body bytes (2 KB). */
const MAX_BODY_BYTES = 2_048;

function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "tooLong" }, { status: 413 });
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rl = checkRateLimit(ip);

  if (rl.limited) {
    return NextResponse.json(
      { ok: false, error: "rateLimited" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  let body: { locale?: unknown; description?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "tooLong" },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid request body" },
      { status: 400 },
    );
  }

  const locale =
    typeof body.locale === "string" ? body.locale.slice(0, 10) : "es";
  const description =
    typeof body.description === "string"
      ? body.description.slice(0, MAX_DESCRIPTION_LENGTH)
      : "";

  const start = Date.now();
  const result = await executePrefill(locale, description);
  const durationMs = Date.now() - start;

  logPrefillUsage({
    ip,
    durationMs,
    outcome: result.ok
      ? "success"
      : result.error === "noFields"
        ? "no_fields"
        : "error",
    ...(result.ok ? {} : { error: result.error }),
  });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      empty: 400,
      tooLong: 413,
      disabled: 503,
    };
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: statusMap[result.error] ?? 500 },
    );
  }

  return NextResponse.json(result);
}
