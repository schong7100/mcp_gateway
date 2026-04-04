# MCP Gateway 보안 에이전트 배포 패키지

**대상**: opencode + Qwen 3.5 환경의 폐쇄망 개발자  
**목적**: 외부 검색 시 민감정보 유출을 사전 차단하는 search-guard 에이전트 설치

---

## 패키지 구성

```
security-agent-package/
├── .opencode/
│   ├── prompts/agents/search-guard.md   ← 에이전트 프롬프트 (Drop-in)
│   ├── rules/security-policy.md         ← 보안 정책 룰 (Drop-in)
│   └── commands/search-guard.md         ← /search-guard 커맨드 (Drop-in)
├── opencode.json.patch                  ← opencode.json 병합 가이드
└── README.md                            ← 이 문서
```

---

## 설치 절차

### Step 1: Drop-in 파일 복사

프로젝트 루트에서 실행합니다.

```powershell
# Windows PowerShell
# 내부 Git에서 보안 패키지 클론
git clone http://<internal-git>/security/opencode-security-agent.git C:\temp\security-agent

# .opencode 디렉토리가 없으면 생성
mkdir .opencode\prompts\agents -Force
mkdir .opencode\rules -Force
mkdir .opencode\commands -Force

# Drop-in 파일 복사
copy C:\temp\security-agent\.opencode\prompts\agents\search-guard.md .opencode\prompts\agents\
copy C:\temp\security-agent\.opencode\rules\security-policy.md .opencode\rules\
copy C:\temp\security-agent\.opencode\commands\search-guard.md .opencode\commands\
```

### Step 2: opencode.json 병합

`%APPDATA%\opencode\opencode.json`을 열어 3곳을 수정합니다.

#### 2-A. instructions 배열에 추가

```diff
  "instructions": [
    "AGENTS.md",
    ".opencode/rules/common-rules.md",
    ".opencode/rules/java-rules.md",
    ".opencode/rules/python-rules.md",
    ".opencode/rules/typescript-rules.md",
+   ".opencode/rules/security-policy.md"
  ],
```

#### 2-B. agent 객체에 추가

```diff
  "agent": {
    "build": { ... },
    "planner": { ... },
    ...
    "database-reviewer": { ... },
+   "search-guard": {
+     "description": "외부 검색 보안 가드. 민감정보 유출 방지를 위해 검색 쿼리를 사전 검토하고 일반화합니다.",
+     "mode": "subagent",
+     "model": "cpf-llmd/RedHatAI/Qwen3.5-122B-A10B-NVFP4",
+     "prompt": "{file:.opencode/prompts/agents/search-guard.md}",
+     "tools": {
+       "read": true,
+       "bash": false,
+       "write": false,
+       "edit": false
+     }
+   }
  },
```

#### 2-C. command 객체에 추가

```diff
  "command": {
    "init": { ... },
    "plan": { ... },
    ...
    "verify": { ... },
+   "search-guard": {
+     "description": "보안 검토 후 외부 검색 실행 (민감정보 자동 일반화)",
+     "template": "{file:.opencode/commands/search-guard.md}\n\n$ARGUMENTS",
+     "agent": "search-guard",
+     "subtask": true
+   }
  },
```

> ⚠️ JSON 쉼표에 주의하세요. 마지막 항목 뒤에 쉼표가 없어야 합니다.

### Step 3: AGENTS.md 보안 정책 확인

프로젝트 루트의 `AGENTS.md`에 `## 보안 정책` 섹션이 있는지 확인합니다.

- **있으면**: 스킵 (이미 적용됨)
- **없으면**: MCP Gateway 저장소의 `AGENTS.md`에서 `## 보안 정책` 섹션을 복사하여 기존 `AGENTS.md` 최상단에 추가

### Step 4: opencode 재시작

opencode를 완전히 종료 후 재시작합니다.

---

## 사용 방법

### /search-guard 커맨드 사용

```
> /search-guard Oracle DB TNS Listener ORA-12541 에러 해결 방법
```

search-guard 에이전트가 쿼리를 검토 후 Context7/Exa를 통해 검색합니다.

### 자동 적용 (instructions)

`security-policy.md`가 instructions에 포함되어 있으므로, **모든 에이전트**가 보안 정책을 인지합니다.
별도 커맨드 없이도 build 에이전트가 외부 검색 시 보안 정책을 따릅니다.

### 민감정보 일반화 예시

| 개발자 입력 | search-guard 변환 | 검색 실행 |
|------------|-------------------|----------|
| `10.10.20.30에서 ORA-12541 에러` | `Oracle DB 서버에서 ORA-12541 에러` | ✅ |
| `db-master 연결 실패 PostgreSQL` | `데이터베이스 서버 연결 실패 PostgreSQL` | ✅ |
| `900101-1234567 조회 API` | ⚠️ 검색 거부 (PII 포함) | ❌ |
| `FastAPI CORS 설정 방법` | 변환 없음 (안전) | ✅ |

---

## 보안 아키텍처 (2계층 방어)

```
개발자 PC                          MCP Gateway (서버)
┌─────────────────────┐           ┌────────────────────┐
│ search-guard 에이전트│           │ 정규식 필터 엔진   │
│ (0차 소프트 방어)    │──HTTP──►│ (1차 하드 방어)     │──►  외부 API
│                     │           │                    │
│ • 쿼리 사전 검토    │           │ • IP/PII 패턴 매칭 │
│ • 민감정보 일반화   │           │ • 403 차단 + 로깅  │
│ • 공격 의도 차단    │           │ • 응답 마스킹      │
└─────────────────────┘           └────────────────────┘
```

- **0차**: search-guard가 대부분의 민감정보를 사전 제거
- **1차**: Gateway 서버가 정규식으로 누락된 민감정보 최종 차단
- 둘 다 우회되어도 검색 로그에 원본이 기록되어 사후 감사 가능

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `/search-guard` 커맨드가 안 보임 | opencode.json 병합 오류 | JSON 문법 확인 (쉼표, 중괄호) |
| 에이전트가 검색을 실행 안 함 | MCP 도구 권한 | opencode.json의 tools에 MCP 접근 확인 |
| 403 차단 발생 | Gateway 서버 필터 | 검색어에서 IP/PII 제거 후 재시도 |
| 401 에러 | API Key 불일치 | opencode.json의 `CONTEXT7_API_KEY`, `EXA_API_KEY`가 Gateway의 `MCP_GATEWAY_PROXY_API_KEY`와 동일한지 확인 |

---

## 참조

- [개발자 PC 설정 가이드](../developer-setup.md)
- [개발자 공지](../developer-notice.md)
- [MCP Gateway 아키텍처](../architecture.md)
