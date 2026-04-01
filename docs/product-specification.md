# MCP Gateway — 제품 명세서

**버전**: 1.0.0  
**작성일**: 2026-03-31  
**분류**: 내부 기술 문서

---

## 1. 제품 개요

### 1.1 제품명

**MCP Gateway** (Model Context Protocol 보안 게이트웨이)

### 1.2 목적

폐쇄망 개발 환경에서 개발자 PC의 AI 코딩 도구(opencode)가 외부 기술 문서 검색 서비스(Context7, Exa)를 안전하게 활용할 수 있도록 중계하는 HTTP 리버스 프록시 시스템.

### 1.3 핵심 가치

| 가치 | 설명 |
|------|------|
| **보안** | 민감 정보가 외부 서비스로 유출되기 전에 자동 차단 처리 |
| **가시성** | 모든 검색 요청/응답을 기록하여 보안 담당자가 모니터링 |
| **투명성** | 개발자의 작업 흐름을 방해하지 않고 백그라운드에서 보안 적용 |
| **통제** | 보안 담당자가 차단 규칙을 실시간으로 관리 |

---

## 2. 시스템 범위

### 2.1 운영 환경

| 구성 요소 | 환경 |
|-----------|------|
| 운영 서버 | RHEL 기반 VM, Podman 컨테이너 |
| 개발자 PC | Windows 11, 폐쇄망 |
| 외부 서비스 | context7.com, api.exa.ai (방화벽 아웃바운드 허용) |
| 네트워크 | 아웃바운드만 허용, 인바운드 차단 |

### 2.2 시스템 구성

```
┌─────────────────────────────────────────────────────────────────┐
│  개발자 PC (Windows 11, 폐쇄망)                                  │
│                                                                  │
│  opencode ──► context7-mcp (stdio)                              │
│               CONTEXT7_API_URL=http://gateway:8000/proxy/c7     │
│                                                                  │
│  opencode ──► exa-mcp-server (stdio)                            │
│               EXA_BASE_URL=http://gateway:8000/proxy/exa        │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP (아웃바운드 전용)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  MCP Gateway (RHEL VM, Podman 컨테이너)                          │
│                                                                  │
│  FastAPI :8000                                                   │
│  ├── 인증 ─► API Key 검증 (개발자 PC)                            │
│  ├── 차단 필터 ─► 요청에서 민감 정보 403 차단           │
│  ├── 리버스 프록시 ─► /proxy/c7/*, /proxy/exa/*                  │
│  ├── 응답 필터 ─► 응답에서 민감 정보 403 차단           │
│  ├── /api/v1/logs ─► 검색 로그 조회                              │
│  ├── /api/v1/filters ─► 차단 규칙 CRUD                        │
│  ├── /api/v1/audit ─► 감사 로그 조회                             │
│  └── /api/v1/users ─► 사용자 관리 (Keycloak 연동)               │
│                                                                  │
│  Next.js :3000 ─► 보안 담당자 모니터링 포털                      │
│  PostgreSQL :5432 ─► 검색 로그, 차단 규칙, 감사 로그           │
│  Keycloak :8080 ─► 단독 IDP (포털 관리자 전용)                   │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS (아웃바운드 전용, 방화벽 허용)
                           ▼
                  context7.com / api.exa.ai
```

---

## 3. 기능 명세

### 3.1 핵심 기능

#### F-01: HTTP 리버스 프록시

| 항목 | 상세 |
|------|------|
| **설명** | 개발자 PC의 MCP 서버 요청을 수신하여 외부 API로 중계 |
| **지원 서비스** | Context7 (`/proxy/c7/*`), Exa (`/proxy/exa/*`) |
| **지원 메서드** | GET, POST |
| **인증** | API Key (`x-api-key` 헤더 또는 `Authorization: Bearer`) |
| **클라이언트 식별** | 요청 IP 주소 기반 |

#### F-02: 요청 필터 (프리-차단)

| 항목 | 상세 |
|------|------|
| **설명** | 외부 서비스로 전송되기 전에 요청 본문/쿼리에서 민감 정보를 `[차단]`로 치환 |
| **처리 시점** | 업스트림 전달 전 |
| **차단 대상** | 요청 쿼리 스트링 + POST 본문 |
| **효과** | 개발자 작업 흐름 유지 (검색은 계속 진행됨) |
| **기록** | 원본 텍스트 + 적용된 규칙명을 DB에 기록 |

#### F-03: 응답 필터

| 항목 | 상세 |
|------|------|
| **설명** | 외부 서비스 응답에서 민감 정보를 `[차단]`로 치환 후 개발자에게 전달 |
| **처리 시점** | 개발자 PC 전달 전 |
| **차단 대상** | 응답 본문 전체 |

#### F-04: 차단 규칙 관리

| 항목 | 상세 |
|------|------|
| **설명** | 보안 담당자가 차단 규칙을 실시간으로 추가/수정/삭제 |
| **규칙 유형** | `regex` (정규식), `keyword` (키워드 목록) |
| **적용 방향** | `request` (요청만), `response` (응답만), `both` (양방향) |
| **서비스 범위** | `all`, `context7`, `exa` |
| **기본 규칙** | 13개 (주민번호, 사설IP, 휴대폰번호, 이메일, 계좌번호, AWS키 등) |

#### F-05: 검색 로그

| 항목 | 상세 |
|------|------|
| **설명** | 모든 검색 요청을 DB에 기록 |
| **기록 항목** | 시간, 사용자IP, 서비스, 검색어, 응답 상태, 차단 여부, 차단 규칙 |
| **조회** | 페이지네이션, 서비스 필터, 차단된 항목만 보기 |

#### F-06: 감사 로그

| 항목 | 상세 |
|------|------|
| **설명** | 시스템 내 모든 액션 이력 기록 |
| **액션 유형** | `search` (검색), `filter_create/update/delete` (규칙 변경) |
| **차단 상세** | 차단 발생 시 적용된 규칙명과 건수 기록 |

#### F-07: 보안 포털 (Frontend)

| 페이지 | 기능 |
|--------|------|
| 대시보드 | 오늘의 검색/차단 건수, 서비스별 파이차트, 시간대별 막대그래프 |
| 검색 로그 | 상세 로그 조회, 차단 상세 확인, 서비스 필터 |
| 필터 규칙 | 규칙 CRUD, 활성/비활성 토글 |
| 감사 로그 | 전체 시스템 액션 이력 |
| 사용자 관리 | Keycloak 연동 관리자 계정 조회 |

---

## 4. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| **가용성** | 단일 VM 배포, Podman 컨테이너 재시작 정책 |
| **보안** | 포털 접근은 Keycloak JWT 인증 필수 |
| **로깅** | 모든 요청 100% 기록 |
| **확장성** | 추가 MCP 서비스는 `/proxy/{service}/*` 라우트 추가로 확장 |
| **배포** | RHEL UBI9 기반 컨테이너, Podman Compose |

---

## 5. 기술 스택

| 레이어 | 기술 |
|--------|------|
| Backend | Python 3.11 / FastAPI / httpx |
| Frontend | Next.js 15 / React 19 / TypeScript / Tailwind CSS v4 |
| Database | PostgreSQL 15 / SQLAlchemy 2.0 (async) / Alembic |
| 인증 | Keycloak (단독 IDP) |
| 배포 | Podman Compose / RHEL UBI9 |

---

## 6. 데이터 모델

### search_logs

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | String | 클라이언트 IP |
| user_name | String | 클라이언트 IP (표시용) |
| service | String | c7 / exa |
| method | String | GET / POST |
| path | String | 요청 경로 |
| request_body | JSONB | 원본 검색어 (쿼리 파라미터 포함) |
| response_status | Integer | HTTP 응답 코드 |
| response_body | JSONB | 응답 본문 |
| filtered | Boolean | 차단 적용 여부 |
| filter_details | JSONB | 차단 규칙 상세 |
| created_at | Timestamp | 요청 시간 (UTC) |

### filter_rules (차단 규칙)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | String | 규칙명 |
| rule_type | String | regex / keyword |
| pattern | String | 패턴 문자열 |
| service | String | all / c7 / exa |
| direction | String | request / response / both |
| enabled | Boolean | 활성화 여부 |
| description | String | 설명 |

### audit_trail

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | String | 액션 수행자 |
| user_name | String | 표시명 |
| action | String | search / filter_create / filter_update / filter_delete |
| resource_type | String | proxy / filter_rule |
| resource_id | String | 대상 리소스 ID |
| details | JSONB | 액션 상세 (차단 규칙명 등) |
| created_at | Timestamp | 발생 시간 (UTC) |

---

## 7. API 엔드포인트

```
# 리버스 프록시 (개발자 PC → 외부 서비스)
GET|POST /proxy/c7/{path}      → context7.com/api/v2/*
GET|POST /proxy/exa/{path}     → api.exa.ai/*

# 검색 로그
GET /api/v1/logs               → 페이지네이션 로그 목록

# 차단 규칙
GET    /api/v1/filters         → 규칙 목록
POST   /api/v1/filters         → 규칙 생성
PATCH  /api/v1/filters/{id}    → 규칙 수정
DELETE /api/v1/filters/{id}    → 규칙 삭제

# 감사 로그
GET /api/v1/audit              → 감사 이력 목록

# 사용자 관리 (Keycloak 프록시)
GET  /api/v1/users             → 사용자 목록
POST /api/v1/users             → 사용자 생성

# 대시보드
GET /api/v1/dashboard/stats    → 통계 집계

# 헬스체크 (인증 불필요)
GET /health
```

---

## 8. 보안 경계

| 경계 | 정책 |
|------|------|
| 포털 접근 | Keycloak JWT 필수, admin 역할 |
| 프록시 접근 | API Key 필수 (`MCP_GATEWAY_PROXY_API_KEY`) |
| 외부 네트워크 | 방화벽 — context7.com, api.exa.ai 아웃바운드만 허용 |
| DB 접근 | 컨테이너 내부 네트워크 전용 |
| 민감 정보 | 차단 규칙에 의해 외부 전달 전 `[차단]` 치환 |
