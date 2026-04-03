# 대시보드 개편 + imbank 디자인 시스템 적용

**작성일**: 2026-04-03
**상태**: 계획 (미구현)

---

## 배경

- 현재 포털: Next.js 15 / Tailwind CSS v4 / recharts
- 디자인 기준: imbank(아이엠뱅크) 브랜드 컬러 시스템 적용
- globals.css에 imbank 컬러 변수 일부 적용 완료 (`--color-primary: #1B3F7A`, `--color-accent: #E8821C`)
- 기능 확장 + 디자인 완성 동시 진행

---

## imbank 디자인 토큰 (CSS 분석 결과)

| 역할 | HEX | 용도 |
|------|-----|------|
| 브랜드 블루 | `#034ea2` | 주요 강조, 링크, 제목 |
| 네이비 | `#1B3F7A` | 내비게이션 배경 |
| 다크 네이비 | `#0b4897` | hover 상태 |
| 오렌지 액센트 | `#E8821C` | 차단/경고 포인트 |
| 텍스트 | `#4d4d4d` | 기본 본문 |
| 테이블 헤더 배경 | `#f1f7fb` | 테이블 th 배경 |
| 구분선 | `#cfcfcf` | 테이블 border |
| 차단/에러 | `#db365d` | 차단 건수, 에러 |
| 폰트 | NotoSansKR → Pretendard | 한국어 금융권 폰트 |

---

## 전체 작업 범위

### Phase 1: Stitch 디자인 의뢰 (Stitch MCP 활성화 후)

**Stitch 프로젝트**: https://stitch.withgoogle.com/project/16167240815562342620

**의뢰 내용**:
```
MCP Gateway 보안 모니터링 포털 UI 설계
- 대상: 금융권 보안 담당자용 내부 관리 포털
- 브랜드: IM뱅크(아이엠뱅크) 컬러 시스템 (#034ea2 파란색 계열)
- 레이아웃: 좌측 사이드바 + 상단 헤더 + 우측 메인 콘텐츠
- 페이지:
  1. 대시보드: 통계 카드 3개 + 기간별 차트 + 차단 상위 10명 바 차트
  2. 검색 로그: 멀티 필터 테이블
  3. 감사 로그: 멀티 필드 검색 + 테이블
  4. 필터 규칙: CRUD 테이블
  5. 사용자 관리: Keycloak 사용자 테이블
  6. 설정: 로고 업로드, 테마 컬러 피커, 다크모드 토글
- 다크모드: 지원 (기본 라이트 모드)
- 차단 건수 강조: 빨간색 배지, 상위 3명 bold+orange
```

---

### Phase 2: Backend API 확장

#### 2-1. `backend/src/api/dashboard.py` 수정
- [ ] `GET /api/v1/dashboard/stats?period=today|week|month` — period 파라미터 추가
  - today: 오늘 0시~현재 (기존)
  - week: 최근 7일
  - month: 최근 30일
- [ ] 차단률(%) 계산 및 반환: `block_rate = blocked / total * 100`
- [ ] 기간 내 `hourly_trend` → period에 맞게 변경 (today→시간별, week→일별, month→일별)
- [ ] `GET /api/v1/dashboard/blocked-users?period=today|week|month` 신규 엔드포인트
  - `search_logs` 테이블에서 `user_name`별 `response_status=403` 카운트
  - 상위 10명 내림차순 반환

#### 2-2. `backend/src/api/audit.py` 수정
- [ ] 기존 `user_id`, `action` 외 필터 파라미터 추가:
  - `start_time`: ISO datetime (이 시각 이후)
  - `end_time`: ISO datetime (이 시각 이전)
  - `ip`: user_name LIKE '%{ip}%' 검색
  - `resource_type`: resource_type 정확 매칭
  - `detail`: details JSONB 텍스트 검색 (PostgreSQL `::text ILIKE`)

#### 2-3. `backend/src/schemas/` 수정
- [ ] `DashboardStats` 스키마에 `block_rate`, `period` 필드 추가
- [ ] `BlockedUser` 스키마 신규: `{user_name, blocked_count}`
- [ ] `AuditTrailList` 파라미터 스키마에 신규 필드 추가

---

### Phase 3: 프론트엔드 디자인 시스템

#### 3-1. `frontend/src/app/globals.css` 완성
- [ ] imbank 정확한 컬러 토큰으로 업데이트
  - `--color-primary: #034ea2`
  - `--color-primary-dark: #0b4897`
  - `--color-table-header: #f1f7fb`
  - `--color-table-border: #cfcfcf`
  - `--color-block: #db365d`
- [ ] 테이블 공통 스타일 클래스 (`.table-banking` — imbank 테이블 스타일)
- [ ] 버튼 공통 스타일 (`.btn-primary`, `.btn-ghost`)
- [ ] 배지 스타일 (`.badge-block`, `.badge-pass`, `.badge-action`)

#### 3-2. `frontend/src/lib/theme.tsx` 생성
- [ ] `ThemeContext` — `darkMode`, `primaryColor`, `logoUrl` 상태 관리
- [ ] `useTheme()` 훅
- [ ] `ThemeProvider` — localStorage 연동, `<html>` 클래스 제어
- [ ] `layout.tsx`에 `ThemeProvider` 래핑

#### 3-3. `frontend/src/components/nav.tsx` 개편
- [ ] 좌측 사이드바 레이아웃으로 변경 (Stitch 디자인 반영)
- [ ] 설정 메뉴 항목 추가 (`/settings`)
- [ ] 로고 영역: `ThemeContext.logoUrl`이 있으면 이미지, 없으면 텍스트 "MCP Gateway"
- [ ] 다크모드 토글 버튼 (달 아이콘)
- [ ] 활성 메뉴 표시 (현재 경로 기준 `aria-current`)

---

### Phase 4: 대시보드 페이지 개편

#### `frontend/src/app/page.tsx`
- [ ] 기간 선택 dropdown (오늘/일주일/한달) — API 호출 파라미터 연동
- [ ] 통계 카드 3개 업데이트:
  - 검색 요청 수 (기간 내 합계)
  - **차단률(%)** (blocked/total × 100, 소수점 1자리)
  - 활성 차단 규칙 수
- [ ] '시간별 검색 트렌드' → **'시간별 검색 요청량'** 텍스트 변경
- [ ] 기간별 차트 데이터 연동:
  - today: X축 = 시간 (00시~23시)
  - week/month: X축 = 날짜
- [ ] **차단 상위 10명 바 차트** 신규 추가:
  - `GET /api/v1/dashboard/blocked-users` 연동
  - 상위 3명은 `fill="#E8821C"` + `fontWeight="bold"` 강조
  - 나머지 7명은 `fill="#034ea2"`
  - 막대 클릭 시 `/audit?user_id={user_name}` 라우팅
- [ ] `lib/api.ts` 업데이트: `fetchDashboardStats(token, period)`, `fetchBlockedUsers(token, period)`

---

### Phase 5: 감사 로그 페이지 개편

#### `frontend/src/app/audit/page.tsx`
- [ ] 검색 필드 확장 (기존: 액션 + 사용자 IP):
  - 시작 시간 (`<input type="date">`)
  - 종료 시간 (`<input type="date">`)
  - IP 입력 (`<input type="text" placeholder="IP 주소">`)
  - 액션 dropdown (기존 유지)
  - 리소스 유형 (`<input type="text" placeholder="리소스 유형">`)
  - 상세 키워드 (`<input type="text" placeholder="상세 내용 검색">`)
- [ ] URL 파라미터 지원: `?user_id=<ip>` — 대시보드 차트 클릭 시 자동 필터링
- [ ] `useSearchParams`로 URL 파라미터 초기값 세팅
- [ ] `lib/api.ts` `fetchAuditTrail` 파라미터 확장

---

### Phase 6: 설정 페이지 신규 생성

#### `frontend/src/app/settings/page.tsx` (신규)
- [ ] **로고 설정**: 파일 업로드 → base64 변환 → localStorage 저장 → Nav에 반영
- [ ] **테마 컬러**: primary color 커스텀 피커 → CSS 변수 오버라이드
- [ ] **다크모드 토글**: 즉시 적용, localStorage 유지
- [ ] **설정 초기화 버튼**: localStorage 삭제 → 기본값 복원

---

## 파일 변경 목록

| 파일 | 유형 | 변경 내용 |
|------|------|-----------|
| `backend/src/api/dashboard.py` | 수정 | period 파라미터, 차단률, blocked-users 엔드포인트 |
| `backend/src/api/audit.py` | 수정 | 검색 필터 5개 추가 |
| `backend/src/schemas/` | 수정 | 스키마 업데이트 |
| `frontend/src/app/globals.css` | 수정 | 디자인 토큰 완성, 공통 클래스 |
| `frontend/src/lib/theme.tsx` | **신규** | 테마 Context |
| `frontend/src/app/layout.tsx` | 수정 | ThemeProvider 래핑 |
| `frontend/src/components/nav.tsx` | 수정 | 사이드바 레이아웃, 설정 메뉴, 다크모드 |
| `frontend/src/app/page.tsx` | 수정 | 기간 dropdown, 차단률, 요청량, 상위 10명 차트 |
| `frontend/src/app/audit/page.tsx` | 수정 | 멀티 필드 검색, URL 파라미터 |
| `frontend/src/app/settings/page.tsx` | **신규** | 로고/컬러/다크모드 설정 |
| `frontend/src/lib/api.ts` | 수정 | 새 함수 및 파라미터 추가 |

---

## 진행 순서

```
[Stitch MCP 활성화 시]
  → Stitch에 디자인 의뢰 (Phase 1)
  → 디자인 결과물 반영 (레이아웃 구조 확정)

[병렬 진행 가능]
  Phase 2 (Backend) ↔ Phase 3 (디자인 시스템)

[순차 진행]
  Phase 3 완료 → Phase 4 (대시보드)
  Phase 3 완료 → Phase 5 (감사 로그)
  Phase 3 완료 → Phase 6 (설정)
```

---

## 구현 체크리스트

### Phase 1: Stitch 디자인 의뢰
- [ ] Stitch MCP로 디자인 브리프 전달
- [ ] 생성된 디자인 확인 및 레이아웃 확정

### Phase 2: Backend
- [ ] dashboard.py — period 파라미터 + 차단률
- [ ] dashboard.py — blocked-users 엔드포인트
- [ ] audit.py — 5개 필터 파라미터 추가
- [ ] schemas 업데이트

### Phase 3: 디자인 시스템
- [ ] globals.css 완성
- [ ] theme.tsx 생성
- [ ] layout.tsx ThemeProvider 적용

### Phase 4: 대시보드
- [ ] 기간 dropdown + API 연동
- [ ] 차단률 카드
- [ ] 시간별 검색 요청량 이름 변경
- [ ] 차단 상위 10명 차트 + 클릭 라우팅

### Phase 5: 감사 로그
- [ ] 멀티 필드 검색 폼
- [ ] URL 파라미터 초기값 연동

### Phase 6: 설정 페이지
- [ ] 로고 업로드
- [ ] 테마 컬러 피커
- [ ] 다크모드 토글

### Phase 7: Nav 개편
- [ ] 사이드바 레이아웃 (Stitch 결과 반영)
- [ ] 로고 영역
- [ ] 다크모드 토글
