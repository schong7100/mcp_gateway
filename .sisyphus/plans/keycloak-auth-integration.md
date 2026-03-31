# Plan: Keycloak 설정 및 Frontend 인증 연동

**Created**: 2026-03-31T02:40:00Z
**Scope**: Keycloak realm 구성 + Frontend keycloak-js 인증 + Backend JWT 검증 E2E

---

## Context

- Keycloak은 `quay.io/keycloak/keycloak:latest` — Podman 컨테이너로 실행 (`:8080`)
- Backend `deps.py`에 JWT 검증 로직 구현 완료 (JWKS 캐시, RS256, audience/issuer 검증)
- Frontend `keycloak.ts`에 설정값 스텁 존재 (url/realm/clientId)
- Frontend 모든 페이지 `'use client'` — API 호출 시 token `""` 전달 (dev_mode)
- `api.ts`의 `apiFetch`가 Bearer token 헤더를 이미 처리
- `users.py`가 Keycloak Admin REST API 프록시 (서비스 계정 토큰)

## Architecture Decision

**Frontend 인증: `keycloak-js` 직접 통합** (not next-auth)
- Why: 모든 페이지가 이미 `'use client'`, 모니터링 포털은 SPA 패턴에 가까움
- next-auth는 Server Component + API Route 기반이라 현재 구조에 과다
- keycloak-js는 OIDC implicit/PKCE flow를 직접 처리, 가볍고 명확

**Keycloak Realm 설정: JSON Import**
- `deploy/keycloak/realm-export.json`으로 선언적 관리
- Podman 볼륨 마운트 + `--import-realm` 옵션으로 자동 적용

## Auth Flow

```
Browser → localhost:3000 (Next.js)
   │
   ├─ keycloak-js init (PKCE) → Keycloak :8080 login page
   │   └─ 로그인 성공 → access_token (JWT) 발급
   │
   ├─ API 호출 시 Authorization: Bearer {token}
   │   └─ Backend deps.py → JWKS 검증 → CurrentUser
   │
   └─ Token 만료 → keycloak-js auto-refresh (refreshToken)
```

---

## NOT in Scope

- Keycloak 테마 커스터마이징
- 소셜 로그인 (OCP IdP Broker 등)
- Multi-realm 구조
- Frontend SSR 인증 (Server Component 보호)
- 기존 Backend 엔드포인트 변경 (이미 JWT 검증 완료)

---

## Tasks

### Phase 1: Keycloak Realm 설정

- [x] **1.1** Keycloak realm export JSON 작성 (`deploy/keycloak/realm-export.json`)
  - realm: `mcp-gateway`
  - clients: `mcp-gateway-api` (confidential, service-account), `mcp-gateway-web` (public, PKCE)
  - roles: `admin`, `viewer` (realm roles)
  - `mcp-gateway-web` redirectUris: `http://localhost:3000/*`
  - `mcp-gateway-web` webOrigins: `http://localhost:3000`
  - `mcp-gateway-api` audience mapper → JWT에 `aud: mcp-gateway-api` 포함
  - 테스트 사용자 2명: `admin-user` (admin role), `viewer-user` (viewer role)

- [x] **1.2** `deploy/podman-compose.yml` 수정
  - keycloak 볼륨 마운트: `./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json`
  - command에 `--import-realm` 추가
  - postgres 이미지를 `postgres:15-alpine`으로 변경 (RHEL 이미지 인증 문제 해결)

- [x] **1.3** Keycloak 기동 및 realm 자동 import 검증
  - `podman-compose down -v && podman-compose up -d` (clean start)
  - `curl http://localhost:8080/realms/mcp-gateway/.well-known/openid-configuration` 성공 확인
  - 토큰 발급 테스트: password grant로 admin-user 토큰 발급

### Phase 2: Frontend 인증 통합

- [x] **2.1** `keycloak-js` 패키지 설치
  - `cd frontend && npm install keycloak-js`

- [x] **2.2** Keycloak provider 구현 (`frontend/src/lib/auth.tsx`)
  - `KeycloakProvider` React context: Keycloak 인스턴스 + token + user 상태
  - `useAuth()` hook: `{ token, user, login, logout, isAuthenticated, isLoading }`
  - init: `keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256' })`
  - Token auto-refresh: `onTokenExpired` → `keycloak.updateToken(30)`
  - user 정보: `keycloak.tokenParsed`에서 username, roles 추출

- [x] **2.3** Layout에 `KeycloakProvider` 적용 (`frontend/src/app/layout.tsx`)
  - `RootLayout`을 Client Component wrapper로 감싸기
  - `<KeycloakProvider>` → `<Nav />` + `<main>{children}</main>`
  - isLoading 상태에서 로딩 스피너 표시

- [x] **2.4** Nav에 사용자 정보 + 로그아웃 표시 (`frontend/src/components/nav.tsx`)
  - 우측에 `username (role)` + 로그아웃 버튼
  - `useAuth()` hook 사용
  - admin이 아닌 경우 "필터 관리", "사용자 관리" 메뉴 숨김

- [x] **2.5** 모든 페이지에서 `useAuth()` token 사용
  - `page.tsx` (대시보드): `const { token } = useAuth();` → `fetchDashboardStats(token)`
  - `logs/page.tsx`: `fetchLogs(token, ...)`
  - `filters/page.tsx`: `fetchFilters(token)`, `createFilter(token, ...)` 등
  - `audit/page.tsx`: `fetchAuditTrail(token, ...)`
  - `users/page.tsx`: `fetchUsers(token)` (admin만 접근)

- [x] **2.6** dev_mode 분기 처리
  - `auth.tsx`에서 `NEXT_PUBLIC_DEV_MODE=true`일 때 Keycloak init 생략
  - 대신 mock user 반환: `{ token: "", user: { username: "developer", roles: ["admin"] } }`
  - 운영/개발 환경 모두 동일한 코드로 동작

### Phase 3: E2E 검증

- [x] **3.1** Backend JWT 검증 E2E
  - Keycloak에서 admin-user 토큰 발급
  - `curl -H "Authorization: Bearer {token}" http://localhost:8000/api/v1/dashboard/stats` → 200
  - 토큰 없이 호출 → 401
  - 만료된 토큰으로 호출 → 401

- [x] **3.2** Frontend 인증 E2E
  - `http://localhost:3000` 접속 → Keycloak 로그인 페이지 리다이렉트
  - admin-user 로그인 → 대시보드 표시, 모든 메뉴 접근 가능
  - viewer-user 로그인 → 대시보드 + 로그 + 감사만 표시, 필터/사용자 메뉴 숨김

- [x] **3.3** Users 페이지 Keycloak 연동 검증
  - admin 로그인 → /users → Keycloak 사용자 목록 표시 확인
  - 사용자 추가 테스트

- [x] **3.4** Git commit + push
  - `feat: integrate Keycloak authentication (realm + frontend PKCE + backend JWT)`

---

## Test Plan

| Test Case | Expected | How to Verify |
|-----------|----------|---------------|
| Realm import | realm-export.json 자동 적용 | well-known endpoint 200 |
| Token 발급 | admin-user JWT 발급 성공 | password grant → access_token |
| Backend JWT 검증 | 유효 토큰 200, 무효 401 | curl with/without token |
| Frontend redirect | 미인증 → Keycloak login | 브라우저에서 localhost:3000 |
| Admin 메뉴 | admin role → 전체 메뉴 | 브라우저 확인 |
| Viewer 제한 | viewer role → 로그만 | 브라우저 확인 |
| Token refresh | 만료 전 자동 갱신 | 장시간 세션 유지 |
| Users API | Keycloak 사용자 목록 | /users 페이지 |

## Failure Modes

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Keycloak 미기동 | Frontend 로그인 불가 | health check + 에러 메시지 |
| JWKS 네트워크 오류 | Backend 401 반환 | JWKS 캐시 + 재시도 |
| Token 만료 미갱신 | API 401 | onTokenExpired 핸들러 |
| CORS 차단 | Frontend API 호출 실패 | Backend CORS 설정 확인 |
| realm-export 오류 | 클라이언트 미생성 | Keycloak 로그 확인 |

## Files to Modify/Create

**Create:**
- `deploy/keycloak/realm-export.json` — Keycloak realm 선언 (신규)
- `frontend/src/lib/auth.tsx` — KeycloakProvider + useAuth hook (신규)

**Modify:**
- `deploy/podman-compose.yml` — Keycloak 볼륨 + import 옵션
- `frontend/src/app/layout.tsx` — KeycloakProvider 래핑
- `frontend/src/components/nav.tsx` — 사용자 정보 + 역할 기반 메뉴
- `frontend/src/app/page.tsx` — useAuth() token 사용
- `frontend/src/app/logs/page.tsx` — useAuth() token 사용
- `frontend/src/app/filters/page.tsx` — useAuth() token 사용 + admin 가드
- `frontend/src/app/audit/page.tsx` — useAuth() token 사용
- `frontend/src/app/users/page.tsx` — useAuth() token 사용 + admin 가드 + Keycloak 연동
- `frontend/package.json` — keycloak-js dependency 추가
