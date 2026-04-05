# 시스템 전체 구성도

## 변경사항
- (2026-03-31) 양방향 콘텐츠 필터링, 단독 Keycloak IDP, Frontend 기능 확장
- (2026-04-05) 개발자 PC에 PreToolUse 훅 추가 — 3계층 보안 방어

## 아키텍처 다이어그램

```mermaid
graph TB
    subgraph DEV["개발자 PC (Windows 11, 폐쇄망)"]
        OC[opencode CLI<br/>+ oh-my-openagent]
        HOOK[PreToolUse 훅<br/>search-guard-hook.js]
        C7M[context7-mcp<br/>stdio]
        EXAM[exa-mcp-server<br/>stdio]
        OC -->|MCP stdio| C7M
        OC -->|MCP stdio| EXAM
        OC -->|"MCP 호출 전 인터셉트"| HOOK
        HOOK -->|"allow/deny/치환"| OC
    end

    subgraph GW["MCP Gateway (RHEL VM, Podman)"]
        subgraph BE["Backend — FastAPI :8000"]
            AUTH[Keycloak JWT<br/>인증 미들웨어]
            REQ_FILTER[요청 필터<br/>민감정보 차단 → 403]
            PROXY[Reverse Proxy<br/>/proxy/c7/* /proxy/exa/*]
            RES_FILTER[응답 필터<br/>민감정보 마스킹 → REDACTED]
            API_LOG[검색 로그 API<br/>/api/v1/logs]
            API_FILTER[필터 규칙 API<br/>/api/v1/filters]
            API_AUDIT[감사 로그 API<br/>/api/v1/audit]
            API_USERS[사용자 관리 API<br/>/api/v1/users]
        end

        subgraph FE["Frontend — Next.js :3000"]
            DASH[대시보드]
            LOG_UI[검색 로그]
            FILTER_UI[필터 규칙 관리]
            AUDIT_UI[감사 로그]
            USER_UI[사용자 관리]
        end

        DB[(PostgreSQL :5432)]
        KC[Keycloak<br/>단독 IDP]
    end

    subgraph EXT["외부 클라우드 서비스"]
        C7API[context7.com/api/v2]
        EXAAPI[api.exa.ai]
    end

    C7M -->|"HTTP"| AUTH
    EXAM -->|"HTTP"| AUTH
    AUTH --> REQ_FILTER
    REQ_FILTER -->|통과| PROXY
    REQ_FILTER -->|"차단 403"| DEV
    PROXY -->|HTTPS outbound| C7API
    PROXY -->|HTTPS outbound| EXAAPI
    C7API --> RES_FILTER
    EXAAPI --> RES_FILTER
    RES_FILTER -->|로깅| DB

    FE --> API_LOG & API_FILTER & API_AUDIT & API_USERS
    API_LOG & API_FILTER & API_AUDIT --> DB
    API_USERS -->|Admin REST API| KC

    style DEV fill:#e3f2fd,stroke:#1565c0
    style GW fill:#f3e5f5,stroke:#6a1b9a
    style EXT fill:#e8f5e9,stroke:#2e7d32
    style REQ_FILTER fill:#ffcdd2,stroke:#c62828
    style RES_FILTER fill:#fff9c4,stroke:#f57f17
```

## 컴포넌트 설명

| 컴포넌트 | 역할 | 포트 |
|----------|------|------|
| FastAPI Backend | HTTP Reverse Proxy + 양방향 필터 + REST API | :8000 |
| Next.js Frontend | 보안 담당자 모니터링 포털 | :3000 |
| PostgreSQL | 검색 로그, 필터 규칙, 감사 추적 | :5432 |
| Keycloak | 단독 IDP — 사용자 인증/관리 | :8080 |

## 환경 설정 (개발자 PC)

```json
{
  "mcpServers": {
    "context7": {
      "env": { "CONTEXT7_API_URL": "http://gateway:8000/proxy/c7" }
    },
    "exa": {
      "env": { "EXA_BASE_URL": "http://gateway:8000/proxy/exa" }
    }
  }
}
```
