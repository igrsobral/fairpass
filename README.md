# FairPass

AI-powered P2P ticket exchange platform — a production-grade full-stack portfolio project demonstrating end-to-end AI product development.

Buy and sell live-event tickets safely with intelligent matchmaking, hybrid search, and fraud-safe barcode verification.

## Key Features

- **AI Matchmaking Agent** — Persistent conversational agent (LangGraph + FastAPI) that searches, negotiates, places holds, verifies barcodes, and sets smart price alerts.
- **Hybrid Search + Rerank** — Natural language queries like *"2 lower-tier tickets for Oasis in Buenos Aires under $180 total"* processed through Qdrant dense + BM25 with RRF fusion and business-aware reranking (price deviation + seller trust).
- **Schema-First Tool Contract** — Single `SearchQuery` schema drives search, agent tools, alerts, and evals — keeping prompts honest and evals deterministic.
- **Ticket Verification MCP Server** — Isolated Model Context Protocol service validating EAN-13/UPC-A checksums and QR/PDF417 shape without persisting raw or PII data.
- **Continuous Eval Harness** — Gold datasets, deterministic metrics, and LLM-as-judge evaluation gated in CI.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), Tailwind v4, tRPC, TanStack Query |
| Backend | FastAPI (uv, Python 3.12), LangGraph |
| Data | PostgreSQL 16 (Drizzle ORM), Redis 7, Qdrant |
| AI | OpenAI (embeddings + chat) behind provider abstraction |
| Verification | Model Context Protocol (TypeScript SDK) |
| Evaluation | JSONL gold datasets + deterministic metrics + LLM-as-judge |
| Infrastructure | Docker Compose, GitHub Actions CI |

## Repository Structure

```
apps/
  web/                  Next.js UI — search, agent chat, listings
  ai-engine/            FastAPI — indexer, hybrid search, LangGraph agent

packages/
  api/                  Drizzle schema, migrations, tRPC router, tool contracts
  mcp-server/           MCP ticket-verification server
  evals/                Eval harness + gold datasets
  tsconfig/             Shared TypeScript configuration
  eslint-config/        Shared ESLint configuration
```

See [`.planning/`](.planning/) for the full project plan (PROJECT, REQUIREMENTS, ROADMAP, STATE).

## Getting Started

**Prerequisites:** Node ≥ 22, pnpm, uv, Docker

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Qdrant)
docker compose up -d

# Build API package and run migrations
pnpm -F @fairpass/api build
pnpm -F @fairpass/api db:migrate

# Start development servers
pnpm dev                 # web on :3000, ai-engine on :8000
```

**Verify installation:**

```bash
# Type check, lint, test, and build
pnpm typecheck && pnpm lint && pnpm test && pnpm build

# Run eval suites
pnpm evals

# Run Python tests (requires Qdrant)
cd apps/ai-engine && uv run pytest
```

**Health check:** `GET http://localhost:3000/api/trpc/health` → `{"ok":true}`

> **Note:** Host ports 5433/6380/6335 are non-default to avoid conflicts with local development services on standard ports.

## Roadmap

| Phase | Status |
| --- | --- |
| 0. Scaffold & Environment | ✅ Complete |
| 1. Core Domain + API | ✅ Complete |
| 2. Hybrid Search + Rerank | ✅ Complete |
| 3. Matchmaking Agent | 🔥 In Progress |
| 4. MCP Verification | Pending |
| 5. Eval Harness + CI Gate | Pending |
| 6. Polish & Demo | Pending |

Full detail in [`.planning/ROADMAP.md`](.planning/ROADMAP.md).

## License

Private — All rights reserved.
