# Routing, Source Docs, Mobile, and PWA

## App Routes

- `/`: desktop family tree page
- `/mobile`: mobile-first family tree page
- `/source`: source document archive and viewer
- `/login`: password login page

## API Routes

### Auth
- `POST /api/auth`: validate password and set `family-auth` cookie
- `DELETE /api/auth`: clear auth cookie

### Family
- `GET /api/family`: fetch all nodes
- `POST /api/family`: create node
- `GET /api/family/[id]`: fetch node
- `PUT /api/family/[id]`: update node
- `DELETE /api/family/[id]`: delete node
- `PUT /api/family/batch`: batch update nodes

### Images
- `GET /api/images`
- `POST /api/images`
- `GET/PUT/DELETE /api/images/[id]`
- `POST/DELETE /api/images/[id]/crop`
- `GET /api/images/counts`

### Source Documents
- `GET /api/sources`: list source documents
- `POST /api/sources`: upload source document
- `GET/PUT/DELETE /api/sources/[id]`: read/update/delete source document

## Auth and Middleware

Middleware enforces login on most routes using `family-auth` cookie.

Public paths currently allowed:
- `/login`
- `/api/auth`
- `/api/family` (prefix rule in middleware)

Everything else redirects to `/login` if cookie is missing.

## Source Document Data Flow

1. Server route `/source` fetches initial rows from `source_documents`.
2. Client components call `/api/sources*` for sort/upload/update/delete.
3. Files are stored in Supabase storage bucket `family-images`.
4. Metadata is stored in `source_documents` table.

## Mobile Route Behavior

- `/mobile` renders a mobile-optimized tree UI.
- Data source is still `family_tree` row `id = 1`.
- Mobile and desktop share the same underlying data and APIs.

## PWA Behavior

- Manifest file: `/manifest.json`.
- Start URL is `/mobile`.
- Apple web app metadata is configured in `src/app/mobile/page.tsx`.
- Safe-area CSS support is in `src/app/globals.css` (`env(safe-area-inset-*)`).
- There is currently no service worker/offline caching implementation.
