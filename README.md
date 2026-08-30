# FairPass

AI-powered P2P ticket exchange & matchmaking platform — a production-grade full-stack
portfolio project. Buy and sell live-event tickets safely with an AI matchmaking agent,
hybrid search, and fraud-safe MCP-based barcode verification.

## Highlights

- **AI Matchmaking Agent** (LangGraph · FastAPI): long-running conversational threads
  that search, negotiate, place holds, verify barcodes, and set smart price alerts.
- **Hybrid search + rerank** (Qdrant dense + BM25, RRF): natural-language queries like
  *"2 lower-tier tickets for Oasis in Buenos Aires under $180 total"* → ranked results
  with price-deviation-from-face-value + seller-trust signals shown as the "why".
- **Schema-first tool contract:** one `SearchQuery` schema drives search, agent tools,
  alerts, and the eval harness — prompts stay honest, evals stay deterministic.
- **Ticket Verification MCP Server:** isolated service validating EAN-13/UPC-A checksums
  and QR/PDF417 shape without persisting raw/PII data.
- **Continuous eval harness + CI gate:** gold datasets, deterministic metrics, and
  LLM-as-judge; regression blocks AI-path PRs.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 16 (App Router), Tailwind v4, tRPC, TanStack Query |
| Backend | FastAPI (uv, Python 3.12), LangGraph |
| Data | PostgreSQL 16 (Drizzle), Redis 7, Qdrant |
| AI | OpenAI (embeddings + chat) behind an abstraction |
| Barcode/verification | Model Context Protocol (TypeScript SDK) |
| Eval | JSONL gold datasets + deterministic metrics + LLM-as-judge |
| Infra | Docker Compose, GitHub Actions CI |

## Repository layout

```
apps/web          Next.js UI (search, agent chat, listings)
apps/ai-engine    FastAPI: indexer, hybrid search + rerank, LangGraph agent
packages/api      Drizzle schema + migrations, tRPC router, tool contracts
packages/mcp-server  MCP ticket-verification server
packages/evals    Eval harness + gold datasets
```

See `.planning/` for the full project plan (PROJECT, REQUIREMENTS, ROADMAP, STATE).

## Getting started

Prereqs: Node ≥ 22, pnpm, uv, Docker.

```bash
pnpm install
docker compose up -d      # postgres:5433, redis:6380, qdrant:6335
pnpm -F @fairpass/api build
pnpm -F @fairpass/api db:migrate
pnpm dev                  # web on :3000, ai-engine on :8000
```

Quick checks:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm evals                                    # deterministic eval suites
cd apps/ai-engine && uv run pytest
```

Web health: `http://localhost:3000/api/trpc/health` → `{"ok":true}` when DB is up.

> Note: host ports 5433/6380/6335 are non-default to avoid colliding with other dev
> services already bound to 5432/6379/6333 on this machine.

## Roadmap

Phase 0 ✅ Scaffold & environment · 1 Core domain + API · **2 Hybrid search 🔥** ·
**3 Matchmaking agent 🔥** · 4 MCP verification · 5 Evals + CI gate · 6 Polish & demo.

Full detail in `.planning/ROADMAP.md`.