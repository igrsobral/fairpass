# AGENTS.md

FairPass: AI-powered P2P ticket marketplace. pnpm + Turborepo monorepo, one shared
tRPC/Drizzle backend package, a Python search/agent engine, and an MCP verification server.

## Commands (run from repo root unless noted)

```bash
docker compose up -d          # postgres:5433, redis:6380, qdrant:6335 (non-default ports!)
pnpm -F @fairpass/api build && pnpm -F @fairpass/api db:migrate
pnpm dev                      # web :3000 + mcp-server (stdio). Does NOT start ai-engine.
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # root gate; turbo `test` builds deps first
pnpm evals                    # TS eval suite (packages/evals)
cd apps/ai-engine && uv run pytest       # Python tests (NOT part of turbo)
```

- **ai-engine is a separate uv (Python 3.12) project** with no package.json — turbo/pnpm
  ignore it. Start it manually:
  `pkill -f "uvicorn fairpass.main:app"; nohup uv run uvicorn fairpass.main:app --port 8000 > /tmp/fairpass-ai.log 2>&1 & disown`
- Env: copy `.env.example` → `.env`. `packages/api` reads standard vars; the Python engine
  reads `FAIRPASS_*` (pydantic-settings env prefix). Embeddings/extractor default to
  `local` (deterministic, offline); OpenAI needs `FAIRPASS_EMBEDDING_PROVIDER=openai` +
  `FAIRPASS_OPENAI_API_KEY` + `OPENAI_API_KEY`.
- `pnpm -F @fairpass/api db:seed [--reset]` — reseed requires also re-syncing the Qdrant
  index (`POST :8000/search/index/sync`) or search sees empty results. Seed data uses
  dates relative to "today", so the active index shrinks as days pass — expected.

## Layout & ownership

- `apps/web` — Next.js 16 App Router UI. Pages `app/*/page.tsx` (mostly server components),
  interactive pieces `components/*.tsx` with `"use client"`. tRPC client under `lib/trpc/`.
- `apps/ai-engine` — FastAPI: Qdrant hybrid search + rerank + LangGraph agent (Phase 3, in progress).
- `packages/api` — Drizzle schema + migrations (`src/db/schema/`, `drizzle/`), tRPC `appRouter`
  (`src/trpc/index.ts`), and domain services (`src/services/*`). This is the single backend
  for web. Web mounts it at `app/api/trpc/[trpc]/route.ts`.
- `packages/mcp-server` — stdio MCP barcode verifier. **Importing it starts the stdio server
  on import** — never import it from other packages (seed has its own inline EAN-13 gen).
- `packages/evals`, `packages/tsconfig`, `packages/eslint-config` — harness / shared config.

## Conventions (deviate with care)

- All internal imports in `packages/*` use explicit `.js` extensions (ESM; vitest/vite-node
  resolves them to `.ts`). `@/*` in web maps to the web root.
- tRPC `appRouter` is the API contract; add procs in `packages/api/src/trpc/index.ts`, not in web.
- `searchQuerySchema` (`packages/api/src/types.ts`) is schema-first: it drives search, alerts,
  agent tools, and evals. Don't fork its shape.
- Search lives in ai-engine; `packages/api/src/services/search.ts` proxies over HTTP to
  `FAIRPASS_AI_ENGINE_URL` (default :8000). snake⇄camel mappers in that file are the only
  shape bridge; zod re-validation detects drift.
- ESLint (flat config): `@typescript-eslint/consistent-type-imports` is an error — use
  `import type`.

## UI (Tailwind v4)

- Tailwind **v4 CSS-first** — there is **no `tailwind.config.*`**. Design tokens live in
  `@theme` in `apps/web/app/globals.css`: `--color-brand-*` indigo scale, `--shadow-card`/
  `--shadow-float`/`--shadow-glass`, `--animate-drift`. The visual language is **light
  Apple-style glass**: translucent surfaces (`bg-white/55` + `backdrop-blur-2xl`), hairline
  borders (`border-white/60` + `ring-1 ring-black/5`), and panel shadows with an inset top
  highlight. `body` has a fixed multi-radial-glow gradient so the blur has colour to sample;
  frosted tint chips use `bg-emerald-500/10` style (not `bg-emerald-50`). Shared atoms
  (`.card`, `.input`, `.label`, `.tile`, `.btn-primary|secondary|ghost|success|danger`,
  `.chip`) are `@layer components`; the button base is an `@utility btn` so variants can
  `@apply btn ...`. Use `@theme`/`@utility`/`@apply`, not JS config.
- Pages (`app/*/page.tsx`) are server components wrapped in `components/page-shell.tsx`
  (Nav + Footer); interactive pieces are `components/*.tsx` with `"use client"`. Auth pages
  use the centered `AuthPageShell` in `components/auth-forms.tsx`.
- No UI kit installed. Event "artwork" is category-graded gradients via `components/event-art.tsx`
  (avoid `next/image`/remote images — keep the build offline-deterministic). Loading states are
  Tailwind `animate-pulse` skeletons, not raw text.
- Gotcha: TanStack Query v5 `enabled:false` queries report `isPending:true` — gate button
  "Searching…" state on `isFetching`, not `isPending` (see `search-box.tsx`).

## Testing quirks

- `packages/api` vitest requires Postgres on 5433 (global-setup auto-creates+migrates
  `fairpass_test`, truncates between tests, `fileParallelism: false`). Run only with
  `docker compose up`.
- ai-engine `pytest` needs Qdrant running for search integration; relevance gold set
  (`tests/gold/search_relevance.jsonl`) is offline/deterministic (no LLM).
- Web e2e (`apps/web/scripts/e2e-check.ts`, run manually with dev servers up) is a Node
  type-stripped script — no build needed.

## CI

`.github/workflows/ci.yml`: TS job = typecheck → lint → test → build; Python job = `uv sync
--frozen` + import check + pytest; compose sanity. Eval gate is Phase 5 (not yet wired).

## Planning docs

`.planning/` (PROJECT, REQUIREMENTS, ROADMAP, **STATE**) is the source of truth; STATE.md
tracks verified phase progress and known gotchas. Current phase: 3 — LangGraph matchmaking agent.