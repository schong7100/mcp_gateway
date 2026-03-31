# Frontend 기능 목록 (단독 Keycloak IDP 기준)

## 변경사항
- **기존**: Keycloak → OCP IdP Broker 연계
- **변경**: Keycloak 단독 IDP (OCP 연계 없음)
- 사용자 관리 기능 Frontend에 추가 필요

## 인증 구조

```
┌─────────────────────────────────────────┐
│           Keycloak (단독 IDP)            │
│                                          │
│  Realm: mcp-gateway                      │
│                                          │
│  Clients:                                │
│  ├── mcp-gateway-api (confidential)     │
│  │   └── 개발자 PC → proxy API 인증     │
│  ├── mcp-gateway-web (public)           │
│  │   └── Frontend 웹 포털 인증           │
│  └── mcp-gateway-admin (confidential)   │
│      └── Backend → Keycloak Admin API   │
│                                          │
│  Roles:                                  │
│  ├── admin    → 필터 관리 + 사용자 관리  │
│  └── viewer   → 로그 조회만              │
└─────────────────────────────────────────┘
```

## 페이지별 기능 상세

### 1. 대시보드 (`/`)

| 위젯 | 데이터 소스 | 설명 |
|-------|------------|------|
| 오늘 검색 요청 수 | `search_logs` COUNT | 금일 프록시 요청 총 건수 |
| 필터링 건수 | `search_logs` WHERE filtered=true | 금일 필터링 발생 건수 |
| 차단 건수 | `search_logs` WHERE response_status=403 | 금일 요청 차단 건수 |
| 활성 필터 규칙 | `filter_rules` WHERE enabled=true | 활성화된 필터 규칙 수 |
| 서비스별 분포 | `search_logs` GROUP BY service | Context7 vs Exa 비율 차트 |
| 최근 필터링 이력 | `search_logs` WHERE filtered=true | 최근 5건 테이블 |

### 2. 검색 로그 (`/logs`)

| 기능 | 설명 |
|------|------|
| 페이지네이션 테이블 | 시간, 사용자, 서비스, 경로, 상태, 필터 플래그 |
| 필터 옵션 | 서비스(Context7/Exa), 사용자, 날짜 범위, 필터링 여부 |
| 상세보기 모달 | 요청/응답 본문, 필터링 상세 (매칭 규칙, 마스킹 텍스트) |
| CSV 내보내기 | 보안 보고서용 데이터 다운로드 |

### 3. 필터 규칙 관리 (`/filters`)

| 기능 | 설명 |
|------|------|
| 규칙 목록 | 이름, 유형, 패턴, 서비스, 방향, 활성 상태 |
| 규칙 생성 | name, rule_type(regex/keyword/quality), pattern, service, direction(request/response/both) |
| 규칙 수정 | 인라인 편집 또는 모달 |
| 활성화/비활성화 토글 | 즉시 적용 |
| 규칙 삭제 | 확인 다이얼로그 |
| 기본 규칙 시드 | 주민등록번호, IP 주소, 민감 키워드 |

### 4. 감사 로그 (`/audit`) — 신규

| 기능 | 설명 |
|------|------|
| 타임라인 뷰 | 시간순 시스템 액션 이력 |
| 액션 유형 필터 | search, filter_create, filter_update, filter_delete, user_login |
| 사용자 필터 | 특정 사용자의 활동 추적 |
| 상세 정보 | 각 액션의 details JSONB 필드 표시 |

### 5. 사용자 관리 (`/users`) — 신규

| 기능 | 설명 |
|------|------|
| 사용자 목록 | Keycloak Admin REST API에서 조회 |
| 사용자 생성 | username, email, 임시 비밀번호, 역할 지정 |
| 역할 관리 | admin / viewer 역할 변경 |
| 사용자 비활성화 | Keycloak에서 enabled=false 설정 |
| 비밀번호 초기화 | 임시 비밀번호 발급 |

**접근 제어**: admin 역할만 사용자 관리 페이지 접근 가능

### 6. 로그인/로그아웃

| 기능 | 설명 |
|------|------|
| OIDC 로그인 | Keycloak 로그인 화면으로 리다이렉트 |
| 세션 관리 | JWT 토큰 자동 갱신 (refresh token) |
| 로그아웃 | Keycloak 세션 + 프론트엔드 세션 동시 만료 |

## Backend API 추가 필요

```
# 기존
GET  /api/v1/logs              # 검색 로그 목록
GET  /api/v1/filters           # 필터 규칙 목록
POST /api/v1/filters           # 필터 규칙 생성
PATCH /api/v1/filters/{id}     # 필터 규칙 수정
DELETE /api/v1/filters/{id}    # 필터 규칙 삭제

# 신규 추가
GET  /api/v1/audit             # 감사 로그 목록
GET  /api/v1/users             # 사용자 목록 (Keycloak proxy)
POST /api/v1/users             # 사용자 생성 (Keycloak proxy)
GET  /api/v1/users/{id}        # 사용자 상세 (Keycloak proxy)
PATCH /api/v1/users/{id}       # 사용자 수정 (Keycloak proxy)
GET  /api/v1/dashboard/stats   # 대시보드 통계
```

## Podman Compose 추가 서비스

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:latest
  environment:
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
    KC_DB_USERNAME: mcp
    KC_DB_PASSWORD: mcp
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
  ports:
    - "8080:8080"
  command: start-dev
  depends_on:
    postgres:
      condition: service_healthy
```
