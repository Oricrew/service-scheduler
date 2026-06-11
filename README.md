# Service Scheduler

Mobile-first scheduling and appointment management app for field-service companies.

The product is designed for companies that send technicians to client locations, such as climatization, HVAC, refrigeration, appliance repair, maintenance, and installation businesses.

## Product Direction

Service Scheduler starts as a company-branded real business tool, while keeping the architecture ready for future multi-company support.

The MVP focuses on:

- A simple public booking flow for clients.
- Supervisor approval before appointments are confirmed.
- Technician assignment and per-technician availability.
- Mobile-first internal dashboard for supervisors and technicians.
- Spanish-first UI with English and Portuguese translation structure.
- Low-cost deployment and operations.

## Core MVP Users

- **Client:** requests an appointment without creating an account.
- **Technician:** views company appointments and assignments from mobile.
- **Supervisor:** confirms requests, assigns technicians, and manages the daily agenda.
- **Admin:** manages users and company settings.

## Recommended Stack

- **Framework:** Next.js with TypeScript
- **App type:** PWA-ready responsive web app
- **Hosting:** Vercel
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth for internal users
- **Authorization:** Supabase Row Level Security
- **Internationalization:** `next-intl`
- **Email:** Resend or another transactional email provider
- **WhatsApp:** manual `wa.me` links for MVP

## Documentation

The main product and architecture planning document is:

- [`MVP_SPECIFICATION.md`](./MVP_SPECIFICATION.md)

It includes:

- User roles and permissions
- Client booking flow
- Supervisor and technician workflows
- Scheduling rules
- Data model draft
- Page list
- Phase roadmap

## Initial MVP Scope

The first version should include:

- Public booking page
- 30-minute appointment slots
- Buenos Aires timezone support
- Working hours:
  - Monday to Friday, 08:00 to 18:00
  - Saturday, 09:00 to 16:00
  - Sunday unavailable
- Pending appointment requests
- Supervisor confirmation
- One or multiple technicians per appointment
- Secure appointment links for clients
- Email notifications
- Mobile-first internal dashboard

## Out Of Scope For MVP

- Online payments
- Public pricing
- Invoices
- Client accounts
- Map routing
- Image/video uploads
- Full WhatsApp Business API integration
- Full SaaS self-service onboarding

## Repository Status

This repository now contains the Phase 0 application foundation and planning documentation.

## Development

Install dependencies:

```sh
npm install
```

Create local environment variables:

```sh
cp .env.example .env
```

Run locally:

```sh
npm run dev
```

Quality checks:

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
```

## Deployment

See [`docs/deployment.md`](./docs/deployment.md).

## Current Status

Phase 0 project foundation is complete. The app includes the Next.js foundation, Tailwind CSS, linting and formatting, `next-intl`, Supabase client helpers, initial route placeholders, responsive layout primitives, and Vercel deployment notes.

