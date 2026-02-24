# CLAUDE.md

Guidance for coding agents working in this repository.

## Project Overview

This is a Next.js-based family tree application backed by Supabase.
It supports password-gated access, family node editing, image uploads, source document management, and mobile/PWA access.

## Commands

```bash
npm run dev           # Start development server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # TypeScript check
npm run setup:verify  # Verify env + Supabase bootstrap state
```

## Architecture

### Tech Stack
- Next.js 16 (App Router)
- React 19 + TypeScript
- Supabase (Postgres + Storage)
- Tailwind CSS 4

### Key Directories
- `src/app/` - pages + API routes
- `src/components/` - UI components
- `src/hooks/` - client hooks
- `src/types/` - shared types
- `src/lib/` - utilities (Supabase client, i18n, validation)
- `supabase/` - canonical bootstrap SQL

## Authentication Flow

- Password login at `/login`
- Server compares password with `FAMILY_PASSWORD`
- Session is cookie-based (`family-auth`)
- Middleware protects most routes except explicit public paths

## Data Model

Primary table:
- `family_tree` (`id` integer PK, `data` JSONB array of FamilyNode)
- App currently reads/writes row `id = 1`

Additional tables:
- `family_images`
- `source_documents`

Storage bucket:
- `family-images`

## API Surface

- `/api/auth` - login/logout
- `/api/family` + `/api/family/[id]` + `/api/family/batch` - family CRUD
- `/api/images` + `/api/images/[id]` + `/api/images/[id]/crop` + `/api/images/counts`
- `/api/sources` + `/api/sources/[id]`

## Environment Variables

```bash
FAMILY_PASSWORD=<password>
NEXT_PUBLIC_SUPABASE_URL=<project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## Bootstrap

Run `supabase/bootstrap.sql` in Supabase SQL editor for new environments.
