# Deployment

## Vercel

Use Vercel's default Next.js deployment settings.

Recommended settings:

- Framework preset: `Next.js`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: leave empty/default

No `vercel.json` is needed yet.

## Environment Variables

Set these in Vercel before deploying:

```txt
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=Service Scheduler
NEXT_PUBLIC_DEFAULT_LOCALE=es
NEXT_PUBLIC_SUPPORTED_LOCALES=es,en,pt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WHATSAPP_COUNTRY_CODE=54
```

## Docker

Build the image:

```sh
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="your-supabase-url" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key" \
  -t service-scheduler .
```

Run the container:

```sh
docker run --rm -p 3000:3000 service-scheduler
```
