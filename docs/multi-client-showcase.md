# Multi-Client Showcase

## Overview

**Oricrew / Service Scheduler** is the multi-tenant SaaS template. The default
public experience (landing page, booking, dashboard) is branded as
*Service Scheduler* and must stay generic.

Individual clients can have **showcase pages** — dedicated landing routes that
present the same UX with the client's own brand identity (logo, colors). These
routes are served by a single dynamic route at `/[locale]/[clientId]` that
reads its configuration from a typed registry and i18n messages keyed by the
client's `id`.

## Architecture

### Client Registry (`lib/clients.ts`)

Every client is registered as an entry in the `clients` array. Each entry
contains **only machine-readable data** — no human-readable display names.
Display names live exclusively in i18n.

```ts
{
  id: "refrigo",
  logo: { src: "/clients/refrigo/logotipo.png", width: 200, height: 71 },
  theme: {
    primary: "#E82020",
    primaryHover: "#c81a1a",
    primaryLight: "#fee2e2",
    secondary: "#1A1A6B",
    secondaryLight: "#eef2ff",
  },
}
```

Exported helpers:

- `clients` — full array, used by the home page clients strip and
  `generateStaticParams`.
- `ClientId` — union type of valid client ids.
- `getClient(id)` — lookup by id; returns `undefined` for unknown ids (the
  dynamic route calls `notFound()` in that case).

### i18n (`messages/{es,en,pt}.json`)

Client copy is organized under two namespaces:

- **`Clients.<clientId>.name`** — the human-readable brand name, used for
  `alt` text and anywhere a display name is needed.
- **`ClientShowcase.<clientId>.*`** — all page copy for the showcase route
  (eyebrow, title, description, benefits, workflow, CTAs, etc.).

No `displayName` or `brand` field exists in the code registry — this keeps
all localizable strings in i18n.

### Dynamic Route (`app/[locale]/[clientId]/page.tsx`)

A single page component handles every client showcase:

1. Validates `clientId` via `getClient()` → `notFound()` for unknown ids.
2. Loads copy from `ClientShowcase.<clientId>.*`.
3. Reads logo src/dimensions from the registry.
4. Sets CSS custom properties (`--client-primary`, `--client-secondary`, etc.)
   as inline styles, consumed by a generic `client-theme.module.css`.

### Theme (`app/[locale]/[clientId]/client-theme.module.css`)

A single CSS Module with class names like `.eyebrow`, `.ctaPrimary`,
`.workflowBg`. All color values reference `var(--client-*)` custom properties
injected at the `<main>` element from the client's `theme` config.

### Logo Assets (`public/clients/<clientId>/`)

Each client's logo files are stored under `public/clients/<clientId>/`.
Use real bitmap (PNG) or properly-structured SVG assets — avoid text-only SVGs
that rely on locally-installed fonts.

## Current Clients

| Client  | Route                   | Brand Colors                           |
| ------- | ----------------------- | -------------------------------------- |
| refrigo | `/[locale]/refrigo`     | Primary `#E82020`, Secondary `#1A1A6B` |

## Adding a New Client

1. **Registry** — add an entry to `clients` in `lib/clients.ts` with `id`,
   `logo`, and `theme`.
2. **Assets** — place logo files in `public/clients/<id>/`.
3. **i18n** — add `Clients.<id>.name` and `ClientShowcase.<id>.*` keys to
   every locale file under `messages/`.
4. That's it — the dynamic route and clients strip pick up the new entry
   automatically.

## Private Forks

For clients that need deeper customization (custom booking flow, unique
dashboard behavior, whitelabel domain), a **private fork** of the repository
is the recommended path. The showcase route in this repo serves as a
lightweight public reference; the private fork handles production deployment.

Example: `Oricrew/Refrigo-service-scheduler` is Refrigo's private fork.
