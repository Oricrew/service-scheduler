# Branding

Service Scheduler uses design tokens to define visual identity. Every color,
radius, and spacing value that shapes the brand flows through a small set of
CSS custom properties. Swapping those tokens is the intended mechanism for
per-company branding — no component code needs to change.

## Token layers

### 1. Global tokens (`app/globals.css`)

The `@theme` block at the top of `globals.css` declares the base palette:

```css
@theme {
  --color-surface: #f8fafc;
  --color-surface-elevated: #ffffff;
  --color-foreground: #020617;
  --color-muted: #64748b;
  --color-primary: #0369a1;
  --color-primary-light: #f0f9ff;
  --color-border: #e2e8f0;
  --color-ring-focus: #e0f2fe;
  --radius-card: 2rem;
  --radius-button: 9999px;
}
```

Tailwind 4 exposes these properties as utility classes (e.g. `bg-primary`,
`text-muted`, `rounded-card`). Changing a value here changes every component
that references the token.

### 2. UI primitives (`components/ui/`)

The shared `Button`, `Card`, `Input`, `Label`, and `Textarea` components
reference the global tokens through Tailwind utilities. For example, `Button`
uses `bg-foreground`, `text-surface-elevated`, and `border-primary` — all of
which resolve to the custom properties above.

Because the primitives never contain literal color values, rebranding them
requires zero code changes; it is enough to update the tokens in
`globals.css`.

### 3. Client showcase tokens (`lib/clients.ts` + CSS Modules)

Client showcase pages add a second layer of tokens scoped to a single route.
Each entry in the client registry declares a `theme` object:

```ts
{
  primary: "#E82020",
  primaryHover: "#c81a1a",
  primaryLight: "#fee2e2",
  secondary: "#1A1A6B",
  secondaryLight: "#eef2ff",
}
```

The showcase page injects these as inline `--client-*` custom properties, and
`client-theme.module.css` maps them to CSS Module class names. This keeps
per-client color logic entirely out of component code.

## How to swap brand colors today

1. **Edit `app/globals.css`** — change the values inside `@theme`. This
   affects the entire application.
2. **Edit `lib/clients.ts`** — change (or add) a client's `theme` object.
   This affects only that client's showcase page.
3. **Verify** — run `npm run build` and visually confirm the new palette.

No Tailwind config file or component-level style overrides are needed. The
tokens propagate everywhere automatically.

## Future work

The items below are **out of scope for the current template** and are
documented here as the intended direction.

### Company logo and color upload (runtime branding)

The preferred path is to let each company manage its own logo and brand
colors at runtime rather than hardcoding values in source:

- Store company branding data (logo URL, primary / secondary / accent colors)
  in Supabase organization/client profiles.
- Store logo files in Supabase Storage, scoped by organization.
- Resolve branding at request time by `clientId` (or `organizationId`) using
  dynamic routes and i18n keys already keyed by id.
- Inject resolved tokens as CSS custom properties the same way the showcase
  route does today with `--client-*` variables.

This approach keeps the template generic — no client names, logos, or hex
values are hardcoded into TSX, alt text, or stylesheets.

### Deep client customization

Clients that need changes beyond color and logo (custom booking flows,
whitelabel domains, unique dashboard behavior) should use a **private fork**
of this repository. The public template stays unbranded; the fork handles
production deployment for a specific company.

### Multi-company token resolution

When multiple organizations share a single deployment (Phase 4 in the
roadmap), token resolution should happen per-request:

1. Identify the organization from the route or session.
2. Fetch that organization's branding record from Supabase.
3. Inject tokens into the page via CSS custom properties.
4. Cache aggressively (branding data changes infrequently).

This mirrors the pattern already in place for showcase pages but shifts the
data source from a static registry to the database.
