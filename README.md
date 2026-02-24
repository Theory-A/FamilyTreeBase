# Family Tree App

A Next.js + Supabase app for maintaining a password-protected family tree with photos, source documents, and mobile/PWA support.

## Quick Start

1. Install dependencies:

```bash
npm ci
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Fill in `.env.local`:
- `FAMILY_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. In Supabase SQL Editor, run:
- [`supabase/bootstrap.sql`](supabase/bootstrap.sql)

5. Verify setup:

```bash
npm run setup:verify
```

6. Start app:

```bash
npm run dev
```

Then open `http://localhost:3000` and log in with `FAMILY_PASSWORD`.

## Data Model (Supabase)

Bootstrap creates:
- `family_tree`: JSONB family graph at row `id = 1`
- `family_images`: uploaded image metadata
- `source_documents`: historical source document metadata
- `family-images` storage bucket

## Key Routes

- `/`: desktop tree view
- `/mobile`: mobile-first tree view + PWA entry route
- `/source`: source document archive
- `/login`: password login

API routes are under `/api/family`, `/api/images`, `/api/sources`, `/api/auth`.

## Common Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run setup:verify
```

## Docs

- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)
- [`docs/EVENTS.md`](docs/EVENTS.md)
- [`docs/ROUTING.md`](docs/ROUTING.md)
- [`docs/EXTENDING.md`](docs/EXTENDING.md)
- [`docs/PUBLIC_RELEASE.md`](docs/PUBLIC_RELEASE.md)

## Notes

- This app currently uses cookie-based app auth plus permissive RLS policies for simplicity.
- For stricter production security, replace with proper user auth and role-scoped RLS policies.
