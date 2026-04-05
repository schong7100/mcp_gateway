# MCP Gateway 보안 에이전트 배포 패키지

**대상**: opencode + Qwen 3.5 + oh-my-openagent 환경의 폐쇄망 개발자  
**목적**: 외부 검색 시 민감정보 유출을 사전 차단하는 search-guard 에이전트 + 자동 훅 설치

---

## 패키지 구성

```
security-agent-package/
├── .opencode/
│   ├── hooks/
│   │   ├── hooks.json                   ← 훅 설정 (PreToolUse/PostToolUse)
│   │   ├── search-guard-hook.js         ← 민감정보 탐지/차단/치환 (자동)
│   │   └── search-log-hook.js           ← 검색 요청/결과 로컬 로깅 (자동)
│   ├── prompts/agents/search-guard.md   ← 에이전트 프롬프트 (수동 커맨드)
│   ├── rules/security-policy.md         ← 보안 정책 룰
│   └── commands/search-guard.md         ← /search-guard 커맨드
├── opencode.json.patch                  ← opencode.json 병합 가이드
└── README.md                            ← 이 문서
```

---

## 보안 아키텍처 (3계층 방어)

```
개발자 PC                                    MCP Gateway (서버)
┌───────────────────────────────────┐       ┌────────────────────┐
│                                   │       │                    │
│  PreToolUse 훅 (코드 레벨 강제)   │       │ 정규식 필터 엔진   │
│  (-1차: 자동, 모델 우회 불가)     │       │ (1차 하드 방어)    │
│  • 정규식으로 IP/PII 탐지         │       │ • 서버 사이드 차단 │
│  • 차단 or 치환 후 허용           │──►│ • 403 + 감사 로깅  │──►  외부 API
│  • 로컬 감사 로그 기록            │       │ • 응답 마스킹      │
│                                   │       │                    │
│  search-guard 에이전트 (AI 레벨)  │       └────────────────────┘
│  (0차: 수동, /search-guard 커맨드)│
│  • LLM이 의미 기반 검토           │
│  • 공격 의도 탐지                 │
│  • 일반화 제안                    │
└───────────────────────────────────┘
```

| 계층 | 방식 | 트리거 | 우회 가능? |
|------|------|--------|-----------|
| **-1차** PreToolUse 훅 | JS 정규식 | 자동 (모든 MCP 호출) | ❌ 불가 |
| **0차** search-guard 에이전트 | LLM 의미 분석 | 수동 (`/search-guard`) | 미호출 시 스킵 |
| **1차** Gateway 서버 필터 | 서버 정규식 | 자동 (서버 사이드) | ❌ 불가 |

---

## 설치 절차

### Step 1: Drop-in 파일 복사

```powershell
# 내부 Git에서 보안 패키지 클론
git clone http://<internal-git>/security/opencode-security-agent.git C:\temp\security-agent

# .opencode 디렉토리 생성
mkdir .opencode\hooks -Force
mkdir .opencode\prompts\agents -Force
mkdir .opencode\rules -Force
mkdir .opencode\commands -Force

# 훅 파일 복사 (자동 방어)
copy C:\temp\security-agent\.opencode\hooks\search-guard-hook.js .opencode\hooks\
copy C:\temp\security-agent\.opencode\hooks\search-log-hook.js .opencode\hooks\
copy C:\temp\security-agent\.opencode\hooks\hooks.json .opencode\hooks\

# 에이전트 파일 복사 (수동 방어)
copy C:\temp\security-agent\.opencode\prompts\agents\search-guard.md .opencode\prompts\agents\
copy C:\temp\security-agent\.opencode\rules\security-policy.md .opencode\rules\
copy C:\temp\security-agent\.opencode\commands\search-guard.md .opencode\commands\
```

### Step 2: 훅 설정 활성화

oh-my-openagent는 `.opencode/hooks/hooks.json`을 자동으로 읽거나, 프로젝트 루트의 `.claude/settings.json`에서 훅을 설정할 수 있습니다.

**방법 A: `.claude/settings.json`에 직접 설정** (확실한 방법)

프로젝트 루트에 `.claude/settings.json`을 생성하거나, 기존 파일에 병합합니다:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__context7__*",
        "hooks": [{ "type": "command", "command": "node .opencode/hooks/search-guard-hook.js" }]
      },
      {
        "matcher": "mcp__exa__*",
        "hooks": [{ "type": "command", "command": "node .opencode/hooks/search-guard-hook.js" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__context7__*",
        "hooks": [{ "type": "command", "command": "node .opencode/hooks/search-log-hook.js" }]
      },
      {
        "matcher": "mcp__exa__*",
        "hooks": [{ "type": "command", "command": "node .opencode/hooks/search-log-hook.js" }]
      }
    ]
  }
}
```

**방법 B: hooks.json 참조** (oh-my-openagent가 자동 로드하는 경우)

`.opencode/hooks/hooks.json`이 이미 복사되어 있으면 oh-my-openagent가 자동으로 로드합니다.

### Step 3: opencode.json 병합 (에이전트 + 커맨드)

`%APPDATA%\opencode\opencode.json`에 3곳을 추가합니다.

#### ① instructions 배열에 추가

```diff
  "instructions": [
    ...
+   ".opencode/rules/security-policy.md"
  ],
```

#### ② agent 객체에 추가

```diff
  "agent": {
    ...
+   "search-guard": {
+     "description": "외부 검색 보안 가드. 민감정보 유출 방지를 위해 검색 쿼리를 사전 검토하고 일반화합니다.",
+     "mode": "subagent",
+     "model": "cpf-llmd/RedHatAI/Qwen3.5-122B-A10B-NVFP4",
+     "prompt": "{file:.opencode/prompts/agents/search-guard.md}",
+     "tools": { "read": true, "bash": false, "write": false, "edit": false }
+   }
  },
```

#### ③ command 객체에 추가

```diff
  "command": {
    ...
+   "search-guard": {
+     "description": "보안 검토 후 외부 검색 실행 (민감정보 자동 일반화)",
+     "template": "{file:.opencode/commands/search-guard.md}\n\n$ARGUMENTS",
+     "agent": "search-guard",
+     "subtask": true
+   }
  },
```

### Step 4: AGENTS.md 보안 정책 확인

`AGENTS.md`에 `## 보안 정책` 섹션이 있는지 확인. 없으면 MCP Gateway 저장소에서 복사하여 최상단에 추가.

### Step 5: opencode 재시작

---

## 동작 확인

### 훅 자동 방어 테스트

일반 대화에서 외부 검색을 유발합니다:

```
> FastAPI에서 CORS 설정하는 방법 알려줘
```

→ AI가 context7/exa 도구를 호출하면 **자동으로** search-guard-hook.js가 실행됩니다.

### 민감정보 차단 테스트

```
> 10.10.20.30 서버에서 ORA-12541 에러 해결 방법 검색해줘
```

→ 훅이 IP를 `[내부서버]`로 치환 후 검색 실행. 사용자에게 `🔒 검색어에서 민감정보를 일반화했습니다` 메시지 표시.

### PII 차단 테스트

```
> 900101-1234567 주민번호로 검색해줘
```

→ 훅이 검색을 **차단**. `민감정보 차단: 주민등록번호` 메시지 표시.

### 로그 확인

```powershell
# 훅 동작 로그
type .opencode\logs\search-guard.log

# 검색 감사 로그 (JSONL)
type .opencode\logs\search-audit.jsonl
```

### /search-guard 수동 커맨드

```
> /search-guard Oracle DB TNS Listener ORA-12541 에러 해결 방법
```

→ LLM 기반 의미 분석으로 쿼리를 검토 후 검색합니다.

---

## 훅이 탐지하는 패턴

### 차단 (deny) — 검색 실행 안 함

| 패턴 | 예시 |
|------|------|
| 주민등록번호 | `900101-1234567` |
| 신용카드번호 | `1234-5678-9012-3456` |
| 계좌번호 | `110-123-456789` |

### 치환 (sanitize) — 일반화 후 검색 실행

| 패턴 | 예시 | 치환 |
|------|------|------|
| 사설 IP (10/172/192) | `10.10.20.30` | `[내부서버]` |
| 이메일 | `user@company.com` | `[이메일]` |
| 휴대폰번호 | `010-1234-5678` | `[전화번호]` |
| DB 접속 문자열 | `postgres://user:pass@host` | `[DB접속정보]` |
| AWS 키 | `AKIA1234567890ABCDEF` | `[AWS키]` |
| Bearer 토큰 | `Bearer eyJhbGci...` | `[인증토큰]` |
| API 키 패턴 | `api_key=abc123def456` | `[인증정보]` |

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 훅이 동작하지 않음 | oh-my-openagent 미설치 | `oh-my-openagent@latest`가 plugin에 있는지 확인 |
| 훅이 동작하지 않음 | hooks.json 미인식 | `.claude/settings.json`에 직접 훅 설정 (방법 A) |
| `🔒` 메시지가 안 보임 | systemMessage 미지원 | 로그 파일(`.opencode/logs/search-guard.log`)로 확인 |
| 403 에러 (훅 통과 후) | Gateway 서버 필터 차단 | 훅이 못 잡는 패턴 — Gateway가 최종 방어 |
| `/search-guard` 안 보임 | opencode.json 병합 누락 | Step 3 확인 |

---

## 참조

- [개발자 PC 설정 가이드](../developer-setup.md)
- [개발자 공지](../developer-notice.md)
- [MCP Gateway 아키텍처](../architecture.md)
