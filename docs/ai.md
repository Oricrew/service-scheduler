# AI Integration

## Overview

Service Scheduler includes an optional, **server-only** AI helper that
generates structured JSON from an AI model provider. The first user-facing
feature is **booking-form prefill** — a client describes their problem in
free text and the AI extracts structured fields to pre-populate the form.
Booking stays public: no login is required to use prefill.

## What is sent to the provider

`completeJson()` sends a single request to Gemini containing:

1. A **system instruction** telling the model to reply with valid JSON only.
2. A **user message** with the prompt supplied by the caller.

The request uses Gemini's JSON mode (`responseMimeType: "application/json"`) so
the model returns parseable JSON directly.

No customer data is sent unless a future feature explicitly includes it in the
prompt. Booking confirmation always stays human — AI may suggest, but a person
must approve.

## Configuration

| Variable        | Required | Default            | Description                                       |
| --------------- | -------- | ------------------ | ------------------------------------------------- |
| `AI_ENABLED`    | no       | `false`            | Set to `true` to activate the AI helper           |
| `GEMINI_API_KEY`| yes\*    | —                  | Google Gemini API key (server-only)                |
| `GEMINI_MODEL`  | no       | `gemini-2.0-flash` | Gemini model identifier for completions            |
| `AI_API_KEY`    | no       | —                  | Legacy alias for `GEMINI_API_KEY` (lower priority) |
| `AI_MODEL`      | no       | —                  | Legacy alias for `GEMINI_MODEL` (lower priority)   |

\*Required only when `AI_ENABLED=true`.

`GEMINI_API_KEY` takes precedence over `AI_API_KEY`, and `GEMINI_MODEL` takes
precedence over `AI_MODEL`. The legacy aliases exist for backwards compatibility
but new deployments should use the `GEMINI_*` variables.

All variables are **server-only** (no `NEXT_PUBLIC_` prefix), so they are never
bundled into the client.

## Kill switch

Set `AI_ENABLED=false` (or remove it) and the prefill API route returns
`503 Service Unavailable`. The rest of the app continues to work normally.
The booking form hides the prefill section when AI is not configured.

## Security & abuse prevention

- **API key is server-only** — `AI_API_KEY` is never exposed to the browser.
  All AI calls happen in server-side code (`lib/ai/`).
- **Public endpoint** — `POST /api/ai/prefill` is available without a session
  because booking is public. If AI fails or is rate-limited, the client
  completes the form manually.
- **Per-IP rate limiting** — an in-memory sliding-window limiter enforces
  both RPM and daily caps keyed on client IP. Exceeding either limit returns
  `429` with a `Retry-After` header.
- **Request body cap** — bodies larger than 2 KB are rejected (`413`);
  description text is further capped at 500 characters.
- **Output token cap** — the provider call sets `max_tokens: 512` to bound
  cost per request.
- **Zod schema validation** — AI responses are validated against a strict
  schema before the app uses them.
- **Usage logging** — every prefill call is logged as structured JSON to
  stdout (IP, latency, outcome). When requests in a 5-minute window
  exceed `AI_SPIKE_THRESHOLD`, an `[AI_SPIKE_ALERT]` warning is emitted.

## Architecture

```
Client (booking-form.tsx)
  └─ fetch POST /api/ai/prefill
       ├─ Rate-limit check (per IP)
       ├─ Body-size guard
       ├─ executePrefill()  (lib/ai/prefill.ts)
       │    └─ completeJson()  (lib/ai/complete-json.ts)
       │         └─ openAiCompatibleProvider  (lib/ai/provider.ts)
       └─ Usage logging  (lib/ai/usage-logger.ts)
```
