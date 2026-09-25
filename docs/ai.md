# AI Integration

## Overview

Service Scheduler includes an optional, **server-only** AI helper that later
features can use to generate structured JSON from a model provider. The helper
uses Google Gemini via the official `@google/generative-ai` SDK.

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

## Turning AI off

Set `AI_ENABLED=false` (or remove it) and remove or leave `GEMINI_API_KEY`
empty. The helper returns a clear disabled result — the rest of the app
continues to work normally.

## Security

- `GEMINI_API_KEY` is never exposed to the browser.
- All AI calls happen in server-side code (`lib/ai/`).
- Responses are validated against a Zod schema before the app uses them.
