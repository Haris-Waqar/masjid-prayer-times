# Repository guidance

Build a calm, accessible single-mosque prayer timetable. Public reading never
requires an account. All writes require both a signed-in identity and explicit
server-side authorization through the Supabase `admin_members` table.

## Architecture

- Standard Next.js App Router application written in TypeScript.
- Supabase Postgres, Auth and row-level security.
- Passwordless email-link sign-in for administrators.
- Standards-based Web Push with VAPID credentials stored as runtime secrets.
- Service-worker caching is for last-known public content only.

## Engineering rules

- Keep secrets out of source and browser bundles.
- Validate and authorize every write inside the route handler.
- Preserve date and time values as mosque-local strings; do not let the server
  timezone silently change their meaning.
- Do not notify when only a prayer-start time changes or when jamaat is unchanged.
- Keep database migrations schema-only and immutable after publication.
- Run type-check, lint and the production build after meaningful changes.
- Maintain keyboard focus states, reduced-motion support and high contrast.

Read `SPEC.md` before changing product behavior.
Follow the repository [engineering handbook](docs/README.md) for coding,
structure, interface, error-handling, and API conventions.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
