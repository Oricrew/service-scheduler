# AI Integration

## Overview

Service Scheduler includes an optional, **server-only** AI helper that later
features can use to generate structured JSON from a model provider. No
user-facing AI features are shipped yet — this is foundation work.

## What is sent to the provider

`completeJson()` sends a single chat-completions request containing:

1. A **system message** instructing the model to reply with valid JSON only.
2. A **user message** with the prompt supplied by the caller.

No customer data is sent unless a future feature explicitly includes it in the
prompt. Booking confirmation always stays human — AI may suggest, but a person
must approve.

## Configuration

| Variable | Required | Default | Description |
| ------------ | -------- | ------------- | --------------------------------------- |
| `AI_ENABLED` | no | `false` | Set to `true` to activate the AI helper |
| `AI_API_KEY` | yes\* | — | API key for the provider (server-only) |
| `AI_MODEL` | no | `gpt-4o-mini` | Model identifier for completions |

\*Required only when `AI_ENABLED=true`.

All three variables are **server-only** (no `NEXT_PUBLIC_` prefix), so they are
never bundled into the client.

## Turning AI off

Set `AI_ENABLED=false` (or remove it) and remove or leave `AI_API_KEY` empty.
The helper returns a clear disabled result — the rest of the app continues to
work normally.

## Security

- `AI_API_KEY` is never exposed to the browser.
- All AI calls happen in server-side code (`lib/ai/`).
- Responses are validated against a Zod schema before the app uses them.
