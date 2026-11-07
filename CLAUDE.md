# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Start with **`AGENTS.md`** — it holds the repository guidance, architecture overview, and engineering rules. Read `SPEC.md` before changing product behavior, `DESIGN.md` before changing UI, and the engineering handbook indexed in `docs/README.md` for coding, structure, API, and error-handling conventions. This file only adds what those don't cover.

## Commands

```sh
npm run dev          # Next dev server (localhost:3000)
npm run build        # Production build
npm run start        # Serve the production build
npm test             # Vitest unit/integration suite (one run, no watch)
npm run test:e2e     # Builds, then runs Playwright on port 3200
npm run lint         # eslint
npm run type-check   # tsc --noEmit
```

- Run a single Vitest file: `npx vitest run lib/prayers.test.ts`
- Run one test by name: `npx vitest run -t "rejects unauthorized"`
- Run a single Playwright spec: `npx playwright test tests/e2e/<file>.spec.ts`
- Playwright browsers install once: `npx playwright install chromium`
- Per `AGENTS.md`, run type-check, lint, and the production build after meaningful changes.

## Next.js 16 note

This repo runs Next.js 16 with breaking changes vs. older Next — read the relevant guide under `node_modules/next/dist/docs/` before writing framework code. Notably, **middleware is `proxy.ts` at the repo root** (not `middleware.ts`); it exports `proxy(request)` + a `config` matcher and handles Supabase session refresh, `/admin` gating, and the forwarded authorized-user header (`lib/admin-session-header.ts`).
