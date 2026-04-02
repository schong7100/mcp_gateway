# 보안 페르소나 강화 계획: CLAUDE.md + skill.md 이원화

**작성일**: 2026-04-02
**상태**: 제안 (미구현)

---

## 배경

현재 `CLAUDE.md` 하나에 보안 페르소나 전체(원칙 + 절차 + 판단 기준 + 알림 포맷)가 혼재.
- 항상 로딩되는데 분량이 무거움
- 검색 안 하는 작업에도 검색 필터 지침이 로딩됨
- 새 보안 시나리오 추가 시 CLAUDE.md가 계속 비대해짐

---

## 핵심 차이점 (두 파일의 역할 분리)

| | CLAUDE.md | skill.md |
|---|---|---|
| **로딩** | 항상 자동 로딩 | 필요할 때 on-demand 로딩 |
| **역할** | "너는 누구고, 항상 지켜야 할 규칙" | "이 작업을 할 때 이 절차를 따라라" |
| **분량** | 짧고 선언적 (규칙 중심) | 길고 절차적 (워크플로우 중심) |
| **비유** | 헌법 (항상 적용되는 원칙) | 매뉴얼 (특정 업무 수행 절차) |

---

## 제안 구조

```
개발자 PC (opencode 프로젝트 루트)
├── CLAUDE.md                          ← 항상 로딩: 보안 정체성 + 핵심 원칙만
└── .claude/
    └── skills/
        ├── security-search-review.md  ← 외부 검색 시 on-demand: 쿼리 검토 절차
        ├── security-code-review.md    ← 코드 리뷰 시 on-demand: 민감정보 탐지
        └── security-incident.md       ← 차단 발생 시 on-demand: 대응 절차
```

---

## 파일별 상세 내용

### 1. CLAUDE.md — 헌법 (항상 적용)

```markdown
# 보안 정책

## 정체성
당신은 폐쇄망 개발 환경의 AI 코딩 어시스턴트입니다.
모든 외부 통신은 MCP Gateway를 경유하며, 보안 필터링이 적용됩니다.

## 핵심 원칙 (예외 없음)
1. 외부 검색(context7, exa) 호출 전 → security-search-review 스킬 적용
2. 코드에 민감정보 하드코딩 금지 (IP, 비밀번호, API키, PII)
3. 검색 불가 주제: 보안 장비 우회, 취약점 공격 벡터, 악성코드 제작
4. Gateway 403 차단 발생 시 → security-incident 스킬 적용

## 민감 정보 분류 (빠른 참조)
| 유형 | 처리 |
|------|------|
| 서버 IP, 호스트명, 내부 도메인, 파일 경로, 직원 정보, 프로젝트명 | → 일반화 필수 |
| 소프트웨어명, 버전, 에러 코드, 라이브러리명, 프레임워크 패턴 | → 그대로 허용 |

## MCP Gateway (서버 사이드 하드 방어)
- Gateway가 정규식 기반 최종 차단 (PII, IP, 인증정보)
- 이 CLAUDE.md는 0차 소프트 방어 — Gateway 이전 단계 예방 역할
```

**특징**: 짧고 선언적. "무엇을" 해야 하는지만 명시. "어떻게"는 skill에 위임.

---

### 2. skill: security-search-review.md — 외부 검색 매뉴얼

```markdown
---
name: security-search-review
description: 외부 검색(context7, exa) 호출 전 쿼리 보안 검토 절차
triggers:
  - context7 검색
  - exa 검색
  - 외부 API 호출
---

# 외부 검색 보안 검토 절차

## Step 1: 검색 쿼리 분해
사용자의 요청에서 검색에 사용될 키워드를 추출하고, 각각을 분류합니다.

### 일반화 대상 (변환 필수)
| 유형 | 판단 기준 | 변환 방법 | 예시 |
|------|----------|----------|------|
| 서버 IP | `10.x`, `172.16-31.x`, `192.168.x` | → "서버" 또는 OS명 | 10.20.30.40 → Linux 서버 |
| 호스트명 | `-db`, `-web`, `-api` 등 서버 역할 암시 | → 역할명 | db-master → 데이터베이스 서버 |
| 내부 도메인 | `.internal`, `.corp`, `.local` | → "내부 서비스" | app.corp → 내부 웹 애플리케이션 |
| 파일 경로 | `/home/`, `/opt/`, `C:\Users\` | → "설정 파일", "로그 파일" 등 | /home/deploy/config.yml → 설정 파일 |
| 직원 정보 | 실명 + 직급/부서 | → 역할명 | 김과장 인증 모듈 → 인증 모듈 |
| 프로젝트명 | 사내 고유 코드명/약어 | → 기술 도메인명 | 프로젝트 알파 결제 → 결제 시스템 |

### 허용 대상 (변환 불필요)
| 유형 | 판단 기준 |
|------|----------|
| 소프트웨어명/버전 | 공개 소프트웨어 (FastAPI, PostgreSQL 15 등) |
| 에러 코드 | 표준 코드 (HTTP 500, SQLSTATE 42P01 등) |
| 라이브러리명 | 오픈소스 패키지 (httpx, pydantic 등) |
| 프레임워크 API | 공식 문서에 있는 패턴 (mapped_column 등) |

## Step 2: 변환 여부에 따른 분기

### 변환이 발생한 경우 → 사용자 알림 (필수)

🔒 보안 검토 완료
┌─────────────────────────────────────────────┐
│ 원본:  [사용자 원문]                          │
│ 변환:  [일반화된 쿼리]                        │
│ 사유:  [각 변환 항목과 이유]                   │
└─────────────────────────────────────────────┘
일반화된 쿼리로 검색을 진행합니다.

### 변환 없는 경우 → 알림 생략, 바로 검색 진행

## Step 3: 검색 실행
일반화된 쿼리로 context7 또는 exa MCP 도구를 호출합니다.

## 판단이 애매한 경우
1. 민감 부분을 제거/일반화한 쿼리를 먼저 제안
2. 개발자에게 선택권 제공
3. "이 쿼리에 [X]가 포함되어 있습니다. 일반화하여 검색할까요?"
```

---

### 3. skill: security-code-review.md — 코드 보안 리뷰

```markdown
---
name: security-code-review
description: 코드 변경 시 민감정보 하드코딩 및 보안 취약점 탐지
triggers:
  - 코드 리뷰
  - PR 리뷰
  - 보안 점검
---

# 코드 보안 리뷰 절차

## 검사 항목

### 1. 하드코딩된 민감정보
- IP 주소 리터럴 (테스트 코드 제외)
- API 키, 토큰, 비밀번호 문자열
- DB 커넥션 스트링
- 내부 도메인 하드코딩

### 2. 보안 취약점 (OWASP 기준)
- SQL 인젝션 (raw query 사용 여부)
- XSS (사용자 입력 미이스케이프)
- 인증/인가 누락 (엔드포인트에 auth 의존성 없음)
- 에러 메시지에 내부 정보 노출

### 3. MCP Gateway 연동 관점
- 새 API 엔드포인트에 `get_current_user` 의존성 있는지
- 필터 규칙 변경 시 `docs/filter_rules.md` 동기화
- 프록시 경로 추가 시 `UPSTREAM_MAP` 업데이트

## 보고 형식

🔍 보안 리뷰 결과
- [CRITICAL] {파일}:{라인} — {문제 설명}
- [WARNING] {파일}:{라인} — {문제 설명}
- [OK] 민감정보 하드코딩 없음
```

---

### 4. skill: security-incident.md — 차단 대응

```markdown
---
name: security-incident
description: Gateway 403 차단 또는 보안 이벤트 발생 시 대응 절차
triggers:
  - 403 차단
  - 필터 매칭
  - 보안 이벤트
---

# 보안 이벤트 대응 절차

## Gateway 403 차단 발생 시

### 개발자에게 안내할 내용
1. 검색 쿼리에 민감 정보(IP, PII, 인증정보)가 포함되어 Gateway에서 차단되었습니다
2. 민감 부분을 일반화한 대체 쿼리를 제안합니다
3. 차단 내역은 감사 로그에 기록되었습니다

### 대체 쿼리 생성
- 차단된 쿼리에서 민감 패턴을 식별
- security-search-review 스킬의 변환 규칙 적용
- 일반화된 쿼리로 재검색 제안

## 반복 차단 패턴 감지
동일 세션에서 3회 이상 차단 발생 시:
- 사용자에게 민감정보 포함 패턴을 종합 안내
- 작업 방식 변경 제안 (로컬 검색, 공식 문서 직접 참조 등)
```

---

## 장점 비교

| 관점 | 현재 (CLAUDE.md 단일) | 제안 (CLAUDE.md + skills) |
|------|----------------------|--------------------------|
| **컨텍스트 효율** | 코드 리팩토링할 때도 검색 필터 지침 로딩 | 검색할 때만 search-review 로딩 |
| **역할 확장** | 새 보안 시나리오 추가 → CLAUDE.md 비대화 | skill 파일만 추가 (code-review, incident 등) |
| **유지보수** | 원칙과 절차가 혼재 | 원칙(CLAUDE.md)과 절차(skill) 분리 |
| **개발자 경험** | 매 작업마다 긴 보안 지침 | 평소엔 짧은 원칙만, 필요 시 상세 절차 |
| **보안 담당자** | 하나의 파일에서 모든 것 관리 | 역할별로 독립 관리/배포 가능 |

---

## 배포 구조 변화

```
보안 정책 git repo (읽기 전용)
├── CLAUDE.md                              ← 항상 로딩 (짧은 원칙)
└── .claude/skills/
    ├── security-search-review.md          ← 외부 검색 시
    ├── security-code-review.md            ← 코드 리뷰 시
    └── security-incident.md               ← 차단 대응 시
```

기존 `deploy.ps1`의 심볼릭 링크 대상에 `.claude/skills/` 디렉토리만 추가.

---

## 구현 체크리스트

| # | 작업 | 산출물 | 완료 |
|---|------|--------|------|
| 1 | CLAUDE.md 슬림화 (원칙만 남기기) | `CLAUDE.md` | ✅ |
| 2 | security-search-review.md 스킬 생성 | `.claude/skills/security-search-review.md` | ✅ |
| 3 | security-code-review.md 스킬 생성 | `.claude/skills/security-code-review.md` | ✅ |
| 4 | security-incident.md 스킬 생성 | `.claude/skills/security-incident.md` | ✅ |
| 5 | architecture/04-security-agent.md 업데이트 | 이원화 구조 반영 | ✅ |
| 6 | docs/developer-setup.md 업데이트 | `.claude/skills/` 심볼릭 링크 배포 가이드 추가 | ✅ |
| 7 | docs/security-officer-manual.md 업데이트 | skill 관리 가이드 추가 | ✅ |
