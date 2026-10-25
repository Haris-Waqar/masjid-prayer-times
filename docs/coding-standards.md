# Coding standards

- Keep TypeScript strict. Avoid `any`, unchecked casts, and non-null assertions; narrow untrusted data at boundaries.
- Use descriptive camelCase names for values/functions, PascalCase for components/types, and kebab-case for route folders.
- Prefer Server Components. Add `"use client"` only at the smallest interactive boundary, and never import secrets or privileged clients there.
- Validate all external input on the server even when the browser also validates it. Set explicit length and shape limits.
- Treat migrations as immutable after they are applied. Create migrations with the Supabase CLI and keep each change backward-compatible when practical.
- Authorize each protected read and mutation at the server boundary. Roles come from `admin_members`, never user-controlled metadata.
- Keep DTOs minimal and explicit. Do not send raw database rows, Auth users, secrets, tokens, push endpoints, or encryption keys to clients.
- Test pure decisions with unit tests, Route Handler contracts with route tests, and critical user journeys with Playwright.
- Never commit secrets. Read server credentials only in server-only modules and document required variables in `.env.example`.
- Prefer small functions, immutable transformations, early returns for invalid state, and comments that explain intent rather than syntax.
