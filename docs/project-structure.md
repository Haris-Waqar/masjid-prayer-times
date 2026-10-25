# Project structure

- `app/` follows Next.js App Router conventions. Colocate a route's private interactive pieces in `_components/` so they cannot become routes.
- Pages are Server Components by default. They authorize and load sanitized initial data before rendering Client Components.
- Route Handlers live under `app/api/`. Mutations and sensitive JSON reads use Route Handlers rather than Server Actions to preserve the established integration contract.
- Reusable authorization, validation, DTO mapping, and data access live under `lib/`. Files that use privileged credentials start with `import "server-only"`.
- Keep feature-specific types near the feature. Move a type into `lib/` only when multiple server/client boundaries share it.
- Colocate focused `route.test.ts` files with Route Handlers. Put browser journeys in `tests/e2e/`.
- Create schema changes under `supabase/migrations/` with `supabase migration new`. Never edit an applied migration.
- Shared UI belongs in `app/components/`; route-specific UI belongs in the route's private `_components/` directory.
