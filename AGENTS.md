# MCP Gateway — AI Agent Workflow

Adapted from [gstack](https://github.com/garrytan/gstack) by Garry Tan.
This file defines the AI-assisted development process for the MCP Gateway project.

## Builder Ethos

### Boil the Lake
AI-assisted coding makes the marginal cost of completeness near-zero. When the complete
implementation costs minutes more than the shortcut — do the complete thing. Every time.

- **Lake** = boilable (100% test coverage for a module, all edge cases, complete error paths)
- **Ocean** = not boilable (multi-quarter platform migration). Flag and defer.
- Tests are the cheapest lake to boil. Never defer tests to a follow-up PR.

### Search Before Building
Before building anything involving unfamiliar patterns, infrastructure, or runtime capabilities:
1. Search for "{runtime} {thing} built-in"
2. Search for "{thing} best practice {current year}"
3. Check official runtime/framework docs (MCP SDK, FastAPI, SQLAlchemy, Next.js, Keycloak)

**Three Layers of Knowledge:**
- **Layer 1: Tried and true** — standard patterns, battle-tested. Verify, don't assume.
- **Layer 2: New and popular** — current best practices. Scrutinize — the crowd can be wrong.
- **Layer 3: First principles** — original reasoning about THIS specific problem. Prize above all.

### User Sovereignty
AI models recommend. Users decide. Cross-model consensus is a strong signal, not a mandate.
Present the recommendation, explain why, state what context you might be missing, and ask.

---

## The Sprint Process

**Think → Plan → Build → Review → Test → Ship → Reflect**

Each phase feeds the next. Design docs inform eng review. Eng review informs implementation.
Review catches bugs that ship verifies are fixed.

---

## Phase Roles

### /think — Problem Definition
Before writing code, understand the problem:
1. Read existing code in the affected area
2. Map dependencies and data flow
3. Challenge premises: Is this the right problem? What happens if we do nothing?
4. What existing code already partially solves this?

### /plan — Engineering Review
Lock architecture before implementation:
1. **Scope Challenge**: What's the minimum set of changes? Flag scope creep.
2. **Architecture**: ASCII diagrams for data flow, state machines, component boundaries
3. **Test Plan**: What needs testing? Coverage targets? Edge cases?
4. **Failure Modes**: For each new codepath, one realistic production failure scenario
5. **NOT in scope**: Explicitly list deferred work

**Complexity smell**: >8 files or >2 new classes → challenge whether it can be simpler.

### /build — Implementation
1. Create todos BEFORE starting (mandatory for 2+ step tasks)
2. Mark `in_progress` before each step, `completed` immediately after
3. Match existing patterns (this is a disciplined codebase)
4. Run diagnostics on changed files at each step
5. Never suppress type errors

### /review — Pre-Landing Review
Two-pass review against the diff:

**Pass 1 (CRITICAL):**
- SQL & Data Safety (injection, missing WHERE clauses)
- Race Conditions & Concurrency (async handlers, DB transactions)
- Auth/Security boundary violations (Keycloak JWT, plugin API keys)
- Missing error handling on external calls (Context7, Exa, Keycloak JWKS)

**Pass 2 (INFORMATIONAL):**
- Dead code & consistency
- Missing edge cases
- Test gaps
- Performance (N+1 queries, missing indexes)

**Fix-First approach:**
- AUTO-FIX obvious issues (dead code, missing imports, formatting)
- ASK for judgment calls (architecture changes, security decisions)

### /test — Verification
- All tests pass
- New code has test coverage
- Integration points verified (plugin stubs, API endpoints)
- Build succeeds (`pip install -e ".[dev]"`, `npm run build`)

### /ship — Release
1. Tests pass on merged state
2. Review complete
3. Commit with conventional commit message
4. Push and create PR (if requested)

### /retro — Reflection
After shipping, ask:
- What went well?
- What was harder than expected?
- What should we do differently next time?
- Any new TODOs surfaced?

---

## Project-Specific Conventions

### Tech Stack
- **Backend**: Python 3.11+ / FastAPI / MCP Python SDK
- **Frontend**: Next.js 15 / React 19 / TypeScript
- **Database**: PostgreSQL 15 / SQLAlchemy 2.0 (async) / Alembic
- **Auth**: Keycloak (OCP SSO via Identity Broker)
- **Deployment**: Podman on RHEL VM (UBI9 base images)

### Code Standards

**Python (Backend):**
- Async everywhere (FastAPI + asyncpg)
- Pydantic v2 for all schemas
- SQLAlchemy 2.0 mapped_column style
- Type hints required on all function signatures
- Ruff for linting (E, F, I, N, UP rules)
- No `# type: ignore`, no `Any` types unless justified

**TypeScript (Frontend):**
- Strict mode enabled
- No `any` types, no `@ts-ignore`
- Server components by default, `"use client"` only when needed
- API calls through `@/lib/api.ts`

**SQL/DB:**
- Alembic for all migrations (never raw DDL)
- UUID primary keys
- JSONB for flexible metadata
- Indexes on foreign keys and frequently queried columns
- Timezone-aware timestamps

### File Organization
```
backend/src/
├── api/           # REST API endpoints (thin controllers)
├── db/            # Models + migrations (data layer)
├── gateway/       # MCP core logic (router, filter)
├── plugins/       # Plugin implementations (Context7, Exa)
└── schemas/       # Pydantic request/response schemas

frontend/src/
├── app/           # Next.js pages (App Router)
├── components/    # Shared UI components
└── lib/           # Utilities (API client, Keycloak)
```

### Naming Conventions
- Python: snake_case for everything
- TypeScript: camelCase for variables/functions, PascalCase for components/types
- DB tables: snake_case, plural (`search_logs`, `filter_rules`)
- API routes: kebab-case (`/api/v1/search/logs`)
- Commits: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`)

### Security Boundaries
- All API endpoints require Keycloak JWT (except `/health`)
- Plugin API keys stored in environment variables, never in code
- Proxy settings via env vars (`HTTP_PROXY`, `HTTPS_PROXY`)
- Content filter rules managed by security team via UI
- Audit trail for all search operations and filter changes

### Testing Strategy
- Backend: pytest + pytest-asyncio
- Frontend: (to be decided — likely Vitest)
- Integration: test against real PostgreSQL (no mocks for DB)
- Plugin tests: mock external APIs (Context7, Exa)

---

## Diagrams

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Internal Network                       │
│                                                           │
│  ┌──────────┐    ┌──────────────────────────────────┐    │
│  │ Frontend  │◄──►│         MCP Gateway (FastAPI)    │    │
│  │ Next.js   │    │  ┌────────────┐ ┌─────────────┐  │    │
│  │ :3000     │    │  │ MCP Router │ │Content Filter│  │    │
│  └────┬─────┘    │  └──────┬─────┘ └──────┬──────┘  │    │
│       │          │         │               │          │    │
│       │          │  ┌──────┴───────────────┴──────┐  │    │
│       │          │  │      Plugin Manager          │  │    │
│       │          │  │  ┌─────────┐ ┌───────────┐  │  │    │
│       │          │  │  │Context7 │ │ exa_search│  │  │    │
│       │          │  │  │ MCP CLI │ │ HTTP API  │  │  │    │
│       │          │  │  └────┬────┘ └─────┬─────┘  │  │    │
│  ┌────┴─────┐   │  └───────┼─────────────┼───────┘  │    │
│  │Keycloak  │   │  :8000   │             │           │    │
│  │  (OCP)   │   └──────────┼─────────────┼──────────┘    │
│  └──────────┘    ──────────┼─────────────┼───── Firewall  │
│                            │ (outbound)  │                │
│  ┌──────────┐              │             │                │
│  │PostgreSQL│              │             │                │
│  │  :5432   │              │             │                │
│  └──────────┘              │             │                │
└────────────────────────────┼─────────────┼────────────────┘
                             ▼             ▼
                      ┌──────────┐  ┌──────────┐
                      │Context7  │  │  Exa AI  │
                      │  Server  │  │  API     │
                      └──────────┘  └──────────┘
```

### Data Flow: Search Request
```
Client Request (JWT)
       │
       ▼
  ┌─────────┐     ┌──────────┐
  │ Auth    │────►│ 401/403  │ (invalid token)
  │ Middleware│    └──────────┘
  └────┬────┘
       │ (valid)
       ▼
  ┌─────────────┐
  │ Search API  │
  │ POST /search│
  └──────┬──────┘
         │
    ┌────┴────┐
    │ Router  │──── plugin_name?
    └────┬────┘     │
         │     ┌────┴────┐
         │     │ All     │ (None = search all)
         │     │ Plugins │
         ▼     └────┬────┘
  ┌──────────┐      │
  │ Plugin   │◄─────┘
  │ .search()│
  └────┬─────┘
       │ raw results
       ▼
  ┌──────────────┐
  │ Filter Engine│
  │ - blocklist  │
  │ - regex      │
  │ - quality    │
  └──────┬───────┘
         │ filtered results
    ┌────┴────┐
    │ DB Save │──► search_logs + search_results + audit_trail
    └────┬────┘
         │
         ▼
    SearchResponse (JSON)
```

### Content Filter Pipeline
```
  Active Rules (from DB)
         │
         ▼
  ┌──────────────────────────────┐
  │  For each search result:     │
  │                              │
  │  ┌─────────┐  match?        │
  │  │Blocklist │──────► FILTERED│
  │  │(keywords)│  no↓          │
  │  └─────────┘                │
  │  ┌─────────┐  match?        │
  │  │ Regex   │──────► FILTERED│
  │  │(pattern)│  no↓          │
  │  └─────────┘                │
  │  ┌─────────┐  below?        │
  │  │Quality  │──────► FILTERED│
  │  │Threshold│  no↓          │
  │  └─────────┘                │
  │         │                    │
  │         ▼                    │
  │      PASSED                  │
  └──────────────────────────────┘
```

---

## AI Effort Compression Reference

| Task type | Human team | AI-assisted | Compression |
|-----------|-----------|-------------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |
| Architecture / design | 2 days | 4 hours | ~5x |
| Research / exploration | 1 day | 3 hours | ~3x |

Completeness is cheap. Don't recommend shortcuts when the complete implementation
is a lake (achievable), not an ocean (multi-quarter migration).

---

## Commands Quick Reference

```bash
# Backend
cd backend && pip install -e ".[dev]"    # install deps
uvicorn src.main:app --reload            # run dev server
pytest                                    # run tests
ruff check src/                          # lint
alembic revision --autogenerate -m "..."  # new migration
alembic upgrade head                      # apply migrations

# Frontend
cd frontend && npm install               # install deps
npm run dev                              # run dev server
npm run build                            # production build
npm run lint                             # lint

# Full Stack (Podman)
cd deploy && cp .env.example .env        # configure env
podman-compose up -d                     # start all services
podman-compose logs -f backend           # watch backend logs
```
