# Multi-Client Showcase

## Overview

**Oricrew / Service Scheduler** is the multi-tenant SaaS template. The default
public experience (landing page, booking, dashboard) is branded as
*Service Scheduler* and must stay generic.

Individual clients can have **showcase pages** — dedicated landing routes that
present the same UX with the client's own brand identity (name, logo, colors).
These routes live under `/[locale]/<client-slug>` and use scoped CSS (CSS
Modules / `data-theme`) so their tokens never leak into the default product.

## Current Clients

| Client   | Route                  | Brand Colors                          |
| -------- | ---------------------- | ------------------------------------- |
| Refrigo  | `/[locale]/refrigo`    | Primary `#E82020`, Secondary `#1A1A6B` |

## Adding a New Client Showcase

1. Create `public/clients/<slug>/` with the client's logo assets.
2. Add a `RefrigoShowcase`-style i18n namespace (e.g. `<Name>Showcase`) to each
   locale file under `messages/`.
3. Create `app/[locale]/<slug>/page.tsx` with a CSS module for scoped brand
   tokens.
4. Add the client to the `clients` array in `app/[locale]/page.tsx` so it
   appears in the "Our Clients" strip on the template landing.

## Private Forks

For clients that need deeper customization (custom booking flow, unique
dashboard behavior, whitelabel domain), a **private fork** of the repository
is the recommended path. The showcase route in this repo serves as a
lightweight public reference; the private fork handles production deployment.

Example: `Oricrew/Refrigo-service-scheduler` is Refrigo's private fork.
