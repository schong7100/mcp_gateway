# MCP Gateway — AI Agent Workflow

Adapted from [gstack](https://github.com/garrytan/gstack) by Garry Tan.
This file defines the AI-assisted development process for the MCP Gateway project.

---

## 보안 정책 (폐쇄망 환경 — 예외 없음)

이 프로젝트는 **폐쇄망 개발 환경**에서 운영됩니다.
모든 외부 통신은 MCP Gateway를 경유하며, 보안 필터링이 적용됩니다.

### 핵심 원칙
1. 코드에 민감정보 하드코딩 금지 (IP, 비밀번호, API키, PII)
2. 검색 불가 주제: 보안 장비 우회, 취약점 공격 벡터, 악성코드 제작
3. Gateway 403 차단 발생 시 → 아래 「차단 대응 절차」 따를 것

### 민감 정보 분류

| 유형 | 처리 |
|------|------|
| 서버 IP, 호스트명, 내부 도메인, 파일 경로, 직원 정보, 프로젝트명 | → 일반화 필수 (`10.x.x.x`, `internal-server` 등) |
| 소프트웨어명, 버전, 에러 코드, 라이브러리명, 프레임워크 패턴 | → 그대로 허용 |

### 외부 검색 쿼리 보안 검토 절차
외부 검색(context7, exa 등) 호출 전 반드시 수행:
1. 쿼리에 민감정보(IP, 호스트명, 내부 도메인, 직원명, 프로젝트명) 포함 여부 확인
2. 포함 시 → 일반화하거나 제거 후 검색
3. 검색 목적이 보안 우회/공격 관련인지 확인 → 해당 시 검색 거부

### 코드 변경 시 민감정보 탐지 절차
코드 작성/수정 시 커밋 전 확인:
1. 하드코딩된 IP, 비밀번호, API 키, 토큰 없는지 확인
2. 환경변수(`os.environ`, `process.env`) 또는 설정 파일로 분리되어 있는지 확인
3. 로그 출력에 민감정보 노출 없는지 확인
4. 발견 시 → 환경변수로 교체, `.env.example`에 키 이름만 기재

### Gateway 차단(403) 대응 절차
Gateway가 요청을 차단한 경우:
1. 차단 사유 확인 (응답 본문의 `filter_details`)
2. 요청에 포함된 민감정보 식별
3. 민감정보 제거/일반화 후 재시도
4. 반복 차단 시 → 보안 담당자에게 보고

### MCP Gateway (서버 사이드 하드 방어)
- Gateway가 정규식 기반 최종 차단 (PII, IP, 인증정보)
- 이 문서의 보안 정책은 0차 소프트 방어 — Gateway 이전 단계 예방 역할

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
3. Check official runtime/framework docs (FastAPI, httpx, SQLAlchemy, Next.js, Keycloak)

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
- Auth/Security boundary violations (Keycloak JWT, API keys in env vars)
- Missing error handling on external calls (upstream proxy, Keycloak JWKS)

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
- Integration points verified (proxy endpoints, filter engine, API endpoints)
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
- **Backend**: Python 3.11+ / FastAPI / httpx (reverse proxy)
- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS v4
- **Database**: PostgreSQL 15 / SQLAlchemy 2.0 (async) / Alembic
- **Auth**: Keycloak (standalone IDP — no OCP integration)
- **Deployment**: Podman on RHEL VM (UBI9 base images)

### Architecture Overview
MCP Gateway is an **HTTP Reverse Proxy** (URL Redirect approach). No MCP SDK on the gateway.
- Developer PCs run `context7-mcp` and `exa-mcp-server` as stdio MCP servers
- API URLs are redirected to Gateway via environment variables (`CONTEXT7_API_URL`, `EXA_BASE_URL`)
- Gateway forwards requests to upstream (context7.com, api.exa.ai) with bidirectional content filtering
- All requests/responses are logged to PostgreSQL for security monitoring

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
│   ├── proxy.py   #   /proxy/c7/*, /proxy/exa/* — reverse proxy
│   ├── logs.py    #   /api/v1/logs — search log queries
│   ├── filters.py #   /api/v1/filters — filter rule CRUD
│   ├── audit.py   #   /api/v1/audit — audit trail queries
│   ├── users.py   #   /api/v1/users — Keycloak user management proxy
│   └── deps.py    #   Auth middleware, DB session dependencies
├── db/            # Models + migrations (data layer)
├── gateway/       # Core proxy + filter logic
│   ├── proxy.py   #   httpx reverse proxy to upstream APIs
│   └── filter.py  #   Bidirectional content filter engine
└── schemas/       # Pydantic request/response schemas

frontend/src/
├── app/           # Next.js pages (App Router)
│   ├── page.tsx           # Dashboard
│   ├── logs/page.tsx      # Search logs
│   ├── filters/page.tsx   # Filter rule management
│   ├── audit/page.tsx     # Audit trail
│   └── users/page.tsx     # User management
├── components/    # Shared UI components
└── lib/           # Utilities (API client, Keycloak)

architecture/      # Architecture documentation + Stitch diagrams
deploy/            # Podman Compose + Containerfiles
docs/              # Developer setup guides
```

### Naming Conventions
- Python: snake_case for everything
- TypeScript: camelCase for variables/functions, PascalCase for components/types
- DB tables: snake_case, plural (`search_logs`, `filter_rules`, `audit_trail`)
- API routes: `/api/v1/{resource}` (RESTful), `/proxy/{service}/{path}` (reverse proxy)
- Commits: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`)

### Security Boundaries
- All API endpoints require Keycloak JWT (except `/health`)
- Keycloak is a **standalone IDP** (no OCP integration) — users managed via Admin REST API
- Keycloak roles: `admin` (full access), `viewer` (read-only logs/audit)
- Exa API key stored in environment variable, never in code
- Proxy settings via env vars (`HTTP_PROXY`, `HTTPS_PROXY`)
- **Bidirectional content filtering**:
  - Request filter: blocks requests containing sensitive patterns (→ 403)
  - Response filter: masks sensitive content with `[REDACTED]` before returning
- Filter rules managed by security officers via Frontend UI (CRUD)
- Audit trail for all operations (search, filter changes, user actions)
- Firewall: outbound-only to context7.com and api.exa.ai (no inbound)

### Testing Strategy
- Backend: pytest + pytest-asyncio + pytest-httpx
- Frontend: (to be decided — likely Vitest)
- Integration: test against real PostgreSQL (no mocks for DB)
- Proxy tests: mock upstream APIs with pytest-httpx (Context7, Exa)
- Filter tests: unit tests with fake rule objects (no DB required)

---

## Diagrams

> Full Mermaid diagrams: see `architecture/` directory
> Stitch visual diagrams: https://stitch.withgoogle.com/project/16167240815562342620

### System Architecture
```
┌───────────────────────────────────────────────────────────────┐
│  개발자 PC (Windows 11, 폐쇄망)                                │
│                                                                │
│  opencode ──► context7-mcp (stdio)                            │
│               CONTEXT7_API_URL → http://gateway:18000/proxy/c7 │
│  opencode ──► exa-mcp-server (stdio)                          │
│               EXA_BASE_URL → http://gateway:18000/proxy/exa    │
└──────────────────────┬────────────────────────────────────────┘
                       │ HTTP (outbound only)
                       ▼
┌───────────────────────────────────────────────────────────────┐
│  MCP Gateway (RHEL VM, Podman)                                │
│                                                                │
│  FastAPI :18000                                                │
│  ├── Auth ─► Keycloak JWT 검증                                │
│  ├── Request Filter ─► 민감정보 포함 시 403 차단              │
│  ├── Reverse Proxy ─► /proxy/c7/*, /proxy/exa/*               │
│  ├── Response Filter ─► 민감정보 [REDACTED] 마스킹            │
│  ├── /api/v1/logs ─► 검색 로그 조회                           │
│  ├── /api/v1/filters ─► 필터 규칙 CRUD                       │
│  ├── /api/v1/audit ─► 감사 로그 조회                          │
│  └── /api/v1/users ─► 사용자 관리 (Keycloak Admin API)       │
│                                                                │
│  Next.js :13000 ─► 보안 담당자 모니터링 포털                   │
│  ├── 대시보드, 검색 로그, 필터 관리, 감사 로그, 사용자 관리   │
│                                                                │
│  PostgreSQL :15432 ─► search_logs, filter_rules, audit_trail   │
│  Keycloak :18080 ─► 단독 IDP (admin/viewer roles)              │
└──────────────────────┬────────────────────────────────────────┘
                       │ HTTPS (outbound only, firewall allowed)
                       ▼
                context7.com / api.exa.ai
```

### Data Flow: Proxy Request (Bidirectional Filtering)
```
Developer PC ──► POST /proxy/c7/libs/search (JWT)
                        │
                   ┌────┴────┐
                   │JWT Auth │──── invalid ──► 401 Unauthorized
                   └────┬────┘
                        │ valid
                   ┌────┴────────┐
                   │Request Filter│──── sensitive info ──► 403 Blocked + log
                   └────┬────────┘
                        │ clean
                   ┌────┴──────┐
                   │ Reverse   │──► HTTPS ──► context7.com/api/v2/libs/search
                   │ Proxy     │◄── 200 OK ◄── upstream response
                   └────┬──────┘
                        │
                   ┌────┴─────────┐
                   │Response Filter│──── sensitive info ──► [REDACTED] masking
                   └────┬─────────┘
                        │
                   ┌────┴────┐
                   │ DB Log  │──► search_logs + audit_trail
                   └────┬────┘
                        │
                        ▼
Developer PC ◄── filtered response
```

### Content Filter: Bidirectional Pipeline
```
                  ┌─── REQUEST FILTER ───┐   ┌── RESPONSE FILTER ──┐
                  │                      │   │                     │
  Request Body ──►│ regex rules ─► match?│   │ regex rules ─► match│──► [REDACTED]
                  │   ├── SSN pattern    │   │   ├── SSN pattern   │
                  │   ├── IP pattern     │   │   ├── IP pattern    │
                  │   └── server info    │   │   └── server info   │
                  │                      │   │                     │
                  │ keyword rules ─► match│  │ keyword rules ─► match│──► [REDACTED]
                  │   ├── password       │   │   ├── password      │
                  │   └── credential     │   │   └── credential    │
                  │                      │   │                     │
                  │ ANY match ──► 403    │   │ ANY match ──► mask  │
                  │ NO match ──► pass    │   │ NO match ──► pass   │
                  └──────────────────────┘   └─────────────────────┘
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

## API Endpoints

```
# Reverse Proxy (developer PC → upstream)
GET|POST /proxy/c7/{path}        # Context7 proxy → context7.com/api/v2/*
GET|POST /proxy/exa/{path}       # Exa proxy → api.exa.ai/*

# Search Logs
GET  /api/v1/logs                # Paginated search log list

# Filter Rules
GET  /api/v1/filters             # List all filter rules
POST /api/v1/filters             # Create filter rule
PATCH /api/v1/filters/{id}       # Update filter rule
DELETE /api/v1/filters/{id}      # Delete filter rule

# Audit Trail
GET  /api/v1/audit               # Paginated audit trail

# User Management (Keycloak Admin API proxy)
GET  /api/v1/users               # List users
POST /api/v1/users               # Create user
GET  /api/v1/users/{id}          # Get user details
PATCH /api/v1/users/{id}         # Update user

# Dashboard
GET  /api/v1/dashboard/stats     # Dashboard statistics

# Health
GET  /health                     # No auth required
```

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
podman-compose logs -f keycloak          # watch keycloak logs
```
