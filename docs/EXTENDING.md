# Extending the App

## Add Fields to FamilyNode

1. Update `src/types/family.ts` with new field(s).
2. Update UI forms/components that read or edit the field.
3. Ensure API handlers pass the new field through unchanged.
4. Confirm `family_tree.data` JSON still serializes and loads correctly.

## Add New API Surface

1. Add route under `src/app/api/<domain>/route.ts`.
2. Keep auth behavior consistent with existing API routes.
3. Add matching client-side fetch integration.
4. Document route usage in `docs/ROUTING.md`.

## Extend Source Document Metadata

1. Add column(s) to `source_documents` via SQL migration.
2. Update `src/types/source.ts`.
3. Update source API route mappings (`GET`, `POST`, `PUT`).
4. Update source UI components to display/edit new fields.

## Extend Image Metadata

1. Add column(s) to `family_images` via SQL migration.
2. Update `src/types/image.ts`.
3. Update image API route mappings.
4. Update relevant UI components and modals.

## Schema Change Checklist

For any schema change, update all of:
- SQL bootstrap/migration
- TypeScript types
- API route read/write mapping
- UI forms + display components
- docs (`README` and routing/feature docs as needed)
