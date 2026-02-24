# Project Structure

## Top Level

- `src/`: application source code
- `public/`: static assets (`events.json`, icons, images)
- `migrations/`: legacy SQL migration files
- `supabase/`: canonical bootstrap SQL for new environments
- `scripts/`: local helper scripts
- `docs/`: project documentation

## `src/` Breakdown

- `src/app/`: Next.js App Router pages and API routes
- `src/components/`: UI components (desktop, mobile, modals, images, source docs)
- `src/hooks/`: reusable client hooks
- `src/lib/`: utilities (Supabase client, i18n, validation)
- `src/types/`: shared TypeScript domain models

## API Route Groups

- `src/app/api/auth/`: login/logout cookie endpoints
- `src/app/api/family/`: family node CRUD + batch update
- `src/app/api/images/`: image upload/metadata/avatar-crop endpoints
- `src/app/api/sources/`: source document CRUD endpoints

## Data and Assets

- `public/events.json`: historical event list used by desktop/mobile timelines
- `public/manifest.json`: PWA manifest with `/mobile` start URL
- `public/logo.png`: app icon for web + PWA metadata
