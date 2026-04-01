# MCP Gateway 필터 규칙 가이드라인

**최종 수정**: 2026-03-31
**근거**: Gemini 보안 컨설팅 + Oracle 실무 검토

---

## 설계 원칙

1. **유출 치명도 기준 우선순위** — false positive 위험과 유출 피해를 균형
2. **양방향 필터링** — request(차단 403) + response(차단 [REDACTED])
3. **보안 담당자 자율성** — 시드 규칙은 범용, 조직 특화 규칙은 UI에서 추가
4. **정규식 정확도** — 과도한 매칭 방지, 실사용 패턴 기반

---

## 카테고리 1: 인증 및 자격증명 (Credentials & Secrets)

가장 치명적인 유출. 코드 복사/붙여넣기로 프롬프트에 노출되는 케이스.

| 규칙명 | 유형 | 방향 | 패턴 | 비고 |
|--------|------|------|------|------|
| AWS 액세스 키 | regex | request | `AKIA[0-9A-Z]{16}` | AWS IAM 키 패턴 |
| 클라우드 시크릿 | regex | both | `(?i)(aws_secret\|gcp_key\|azure_secret\|client_secret)\s*[=:]\s*\S+` | 주요 클라우드 시크릿 할당문 |
| 인증 토큰 키워드 | keyword | both | `API_KEY,ACCESS_TOKEN,SECRET_TOKEN,Bearer,JWT_SECRET,PRIVATE_KEY,SSH_KEY` | 인증 관련 키워드 |
| 민감 키워드 | keyword | both | `password,secret,credential,private_key,비밀번호,passwd,token,api_key,access_key` | 범용 민감 키워드 (시드) |

### 보류/향후 검토
- Base64 인코딩된 긴 문자열 (인증서) — false positive 높음, 길이 기반 탐지 필요
- GitHub PAT (`ghp_`), GitLab token (`glpat-`) — 조직 필요 시 추가

---

## 카테고리 2: 네트워크 및 인프라 (Internal Infrastructure)

사내망 구조가 외부 검색 엔진(Exa)의 쿼리로 유출되는 것을 방지.

| 규칙명 | 유형 | 방향 | 패턴 | 비고 |
|--------|------|------|------|------|
| 사설 IP 대역 | regex | request | `(?:10\.\d{1,3}\|172\.(?:1[6-9]\|2\d\|3[01])\|192\.168)\.\d{1,3}\.\d{1,3}` | RFC1918 사설IP → 요청만 차단 |
| IP 주소 (응답) | regex | response | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}` | 응답에서 모든 IP 차단 (시드) |
| 내부 도메인 | regex | both | `\b[\w.-]+\.(?:internal\|corp\|local)\b` | *.internal, *.corp, *.local |
| DB 접속 정보 | regex | both | `(?i)(?:mysql\|postgres\|mongodb\|redis)://\S+` | DB connection string |

### 보류/향후 검토
- VPN/DMZ/BASTION 키워드 — 단독 키워드는 기술 문서 검색에서 false positive
- 특정 포트+호스트 조합 (`host:5432`) — 패턴이 너무 광범위

---

## 카테고리 3: 개인정보 (PII)

테스트 데이터를 실데이터로 사용하는 실수 방지.

| 규칙명 | 유형 | 방향 | 패턴 | 비고 |
|--------|------|------|------|------|
| 주민등록번호 | regex | both | `\d{6}-[1-4]\d{6}` | 대한민국 주민번호 (시드) |
| 휴대폰번호 | regex | both | `01[016789]-?\d{3,4}-?\d{4}` | 한국 휴대폰 |
| 이메일 주소 | regex | request | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | 요청만 차단 (응답 차단 시 과다) |
| 신용카드번호 | regex | both | `\b(?:4\d{3}\|5[1-5]\d{2}\|6011\|3[47]\d{2})\d{8,12}\b` | Visa/Master/Discover/Amex |
| 계좌번호 | regex | both | `\b\d{3}-?\d{2,6}-?\d{2,6}-?\d{2,4}\b` | 한국 은행 계좌 패턴 |

### 보류/향후 검토
- 여권번호 (`[A-Z]\d{8}`) — 사용 빈도 낮음
- 운전면허번호 — 패턴 다양, 조직 필요 시 추가

---

## 카테고리 4: 사내 기밀 (Corporate Confidential) — UI 추가 권장

프로젝트명, 비즈니스 전략 등은 **조직마다 다르므로 시드 불가**.
보안 담당자가 Frontend UI (`/filters`)에서 직접 추가하는 것이 적합.

### 추가 예시 가이드
- 프로젝트 코드명: keyword — `Project_Alpha,Operation_Blue` 등
- Jira 티켓 패턴: regex — `(ENG|FE|BE|OPS)-\d{3,5}`
- 기밀 등급 키워드: keyword — `CONFIDENTIAL,PROPRIETARY,대외비,1급비밀`
- 비즈니스 키워드: keyword — `M&A,인수합병,SALARY,ORG_CHART`

---

## 카테고리 5: 위험 명령어 (Dangerous Instructions) — 보류

MCP Gateway는 **검색 프록시**이므로, 위험 명령어 필터는 우선순위가 낮음.
코드 생성/실행 컨텍스트에서의 필터링은 별도 시스템(IDE 플러그인, CI/CD) 영역.

### 향후 필요 시 추가
- keyword: `rm -rf,chmod 777,DROP TABLE,TRUNCATE,reverse shell`
- keyword: `eval(),exec(),subprocess.call,os.system`

---

## 필터링 전략 (구현됨)

| 전략 | 구현 상태 | 비고 |
|------|----------|------|
| Regex Scan | ✅ 구현됨 | `filter.py` — 요청/응답 정규식 매칭 |
| Keyword Blacklist | ✅ 구현됨 | `filter.py` — 대소문자 무시 키워드 매칭 |
| Placeholder 치환 | ✅ 구현됨 | `redact()` — 응답에서 `[REDACTED]` 차단 |
| Context Sanitization | ❌ 미구현 | context7 코드 블록 전처리 — 향후 고도화 |
| LLM-based Check | ❌ 미구현 | SLM 기반 기밀 판단 — 향후 고도화 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-03-31 | 초기 가이드라인 작성 (Gemini 컨설팅 + Oracle 검토) |
| 2026-03-31 | 시드 규칙 3개 → 13개 확장 (카테고리 1-3) |
