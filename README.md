# MCP Gateway

AI 검색 도구(Context7, Exa)를 위한 HTTP Reverse Proxy Gateway.
개발자 PC의 MCP 클라이언트가 폐쇄망에서 외부 AI 검색 서비스에 접근할 수 있도록 프록시하며,
보안 담당자가 검색 로그를 모니터링하고 콘텐츠 필터를 관리할 수 있는 웹 포털을 제공합니다.

## Architecture

```
개발자 PC (Windows 11, 폐쇄망)
  opencode → context7-mcp (CONTEXT7_API_URL → gateway/proxy/c7)
  opencode → exa-mcp-server (EXA_BASE_URL → gateway/proxy/exa)
        │
        ▼ HTTP (outbound only)
MCP Gateway (RHEL VM, Podman)
  FastAPI :8000  ← Reverse Proxy + Content Filter + Audit Log
  PostgreSQL     ← 검색 로그, 필터 규칙, 감사 추적
  Next.js :3000  ← 보안 담당자 모니터링 포털
  Keycloak       ← OCP SSO 인증
        │
        ▼ HTTPS (outbound, 방화벽 허용)
  context7.com / api.exa.ai
```

## Quick Start

### Backend
```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn src.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Full Stack (Podman)
```bash
cd deploy
cp .env.example .env  # configure
podman-compose up -d
```

## Content Filtering

보안 담당자가 웹 UI에서 필터 규칙을 관리합니다:

| 유형 | 설명 | 예시 |
|------|------|------|
| `regex` | 정규식 패턴 | 주민등록번호, IP 주소, 서버 정보 |
| `keyword` | 키워드 블랙리스트 | credential, private_key, 비밀번호 등 |
| `quality` | 품질 임계값 | 낮은 품질 결과 필터링 |

필터링된 콘텐츠는 `[REDACTED]`로 마스킹 처리되어 개발자에게 전달됩니다.

## Tech Stack

- **Backend**: Python 3.11 / FastAPI / httpx / SQLAlchemy 2.0 (async)
- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS
- **Database**: PostgreSQL 15 (Alembic migrations)
- **Auth**: Keycloak (OCP SSO)
- **Deploy**: Podman on RHEL (UBI9 base images)
