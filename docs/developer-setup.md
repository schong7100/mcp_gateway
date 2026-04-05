# 개발자 PC 설정 가이드

**대상**: Windows 11 폐쇄망 환경에서 opencode를 사용하는 개발자  
**환경**: Windows 11, Node.js 20+, opencode CLI, Nexus npm registry

---

## 사전 요구사항

| 항목 | 요구사항 |
|------|---------|
| OS | Windows 11 |
| Node.js | 20 이상 (Nexus에서 설치) |
| opencode | CLI 설치 완료 |
| npm registry | Nexus 프록시 설정 완료 (`npm config get registry`로 확인) |
| 네트워크 | MCP Gateway 서버 접근 가능 (`http://<gateway-ip>:18000`) |

---

## 1. MCP 서버 설치

Nexus npm registry를 통해 설치합니다.

```powershell
# Context7 MCP (라이브러리 문서 검색)
npm install -g @upstash/context7-mcp

# Exa MCP (웹 검색)
npm install -g exa-mcp-server
```

### Exa MCP 패치 (필수)

exa-mcp-server는 API URL이 하드코딩되어 있어 `EXA_BASE_URL` 환경변수를 지원하도록 패치해야 합니다.

```powershell
# 1. exa-mcp-server 설치 경로 확인
$ExaPath = "$(npm root -g)\exa-mcp-server\.smithery\stdio\index.cjs"

# 2. 파일 존재 확인
if (Test-Path $ExaPath) { Write-Host "OK: $ExaPath" } else { Write-Host "ERROR: 파일 없음" }

# 3. 원본 백업
Copy-Item $ExaPath "$ExaPath.bak"

# 4. EXA_BASE_URL 환경변수 지원 패치
(Get-Content $ExaPath -Raw) -replace `
    'e="https://api.exa.ai"', `
    'e=process.env.EXA_BASE_URL||"https://api.exa.ai"' | `
    Set-Content $ExaPath -NoNewline

# 5. 패치 확인
if ((Get-Content $ExaPath -Raw) -match 'EXA_BASE_URL') {
    Write-Host "패치 성공"
} else {
    Write-Host "패치 실패 — 수동 확인 필요"
}
```

---

## 2. opencode 설정

opencode 설정 파일에 MCP 서버를 등록합니다.

**설정 파일 위치**: `%APPDATA%\opencode\opencode.json`

### 2-A. 신규 설정 (opencode.json이 없거나 MCP 설정이 없는 경우)

```json
{
  "mcp": {
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "environment": {
        "CONTEXT7_API_URL": "http://<gateway-ip>:18000/proxy/c7",
        "CONTEXT7_API_KEY": "727a17912b5c1b79564ba42e59b47ae17dc65c82df35717adb14e75d0bb27b0b",
        "DEFAULT_MINIMUM_TOKENS": "5000"
      }
    },
    "exa": {
      "type": "local",
      "command": ["exa-mcp-server"],
      "environment": {
        "EXA_BASE_URL": "http://<gateway-ip>:18000/proxy/exa",
        "EXA_API_KEY": "727a17912b5c1b79564ba42e59b47ae17dc65c82df35717adb14e75d0bb27b0b"
      }
    }
  }
}
```

### 2-B. 기존 MCP 설정이 있는 경우 (병합)

이미 Nexus MCP 등 다른 MCP 서버가 설정되어 있다면, **기존 `"mcp"` 객체 안에 `"context7"`과 `"exa"` 항목만 추가**합니다.

```json
{
  "mcp": {
    "nexus": { ... },
    "기존-mcp-서버": { ... },

    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "environment": {
        "CONTEXT7_API_URL": "http://<gateway-ip>:18000/proxy/c7",
        "CONTEXT7_API_KEY": "727a17912b5c1b79564ba42e59b47ae17dc65c82df35717adb14e75d0bb27b0b",
        "DEFAULT_MINIMUM_TOKENS": "5000"
      }
    },
    "exa": {
      "type": "local",
      "command": ["exa-mcp-server"],
      "environment": {
        "EXA_BASE_URL": "http://<gateway-ip>:18000/proxy/exa",
        "EXA_API_KEY": "727a17912b5c1b79564ba42e59b47ae17dc65c82df35717adb14e75d0bb27b0b"
      }
    }
  }
}
```

> ⚠️ **주의**: 기존 설정을 덮어쓰지 마세요. JSON 문법 오류(쉼표 누락 등)를 확인하세요.

**필수 변경:**
- `<gateway-ip>`: MCP Gateway 서버 IP (IT 담당자에게 확인)
- Proxy API Key는 위 설정에 이미 포함되어 있습니다 (전 개발자 공통)

> **참고**: `EXA_API_KEY`에도 Proxy API Key를 설정합니다. 실제 Exa API Key는 Gateway 서버에서 관리합니다.

---

## 3. 보안 페르소나 및 보안 에이전트 배포

보안 담당자가 관리하는 보안 정책 파일과 search-guard 에이전트를 프로젝트에 배포합니다.

### 3-A. AGENTS.md 보안 정책

`AGENTS.md`는 프로젝트 저장소에 이미 포함되어 있으므로 `git clone`만 하면 자동 적용됩니다.

```powershell
# 프로젝트 클론 시 AGENTS.md가 자동 포함
git clone https://github.com/schong7100/mcp_gateway.git
cd mcp_gateway
# → AGENTS.md에 보안 정책이 이미 포함되어 있음
```

**기존 프로젝트에 AGENTS.md가 있는 경우:**

개발자가 자신의 프로젝트에 이미 `AGENTS.md`를 사용 중이라면, MCP Gateway 보안 정책 섹션을 기존 파일에 **병합**해야 합니다.

```powershell
# MCP Gateway의 AGENTS.md에서 "## 보안 정책" ~ 다음 "## " 이전까지 복사
# 기존 AGENTS.md 최상단에 붙여넣기 (보안 정책이 가장 먼저 읽히도록)
```

> ⚠️ **핵심**: 보안 정책 섹션(`## 보안 정책`)이 AGENTS.md 내에 반드시 존재해야 합니다. 삭제하거나 수정하지 마세요.

### 3-B. search-guard 보안 에이전트 설치

search-guard는 외부 검색 시 민감정보를 사전 검토하고 일반화하는 **0차 소프트 방어 에이전트**입니다.

배포 패키지는 `docs/security-agent-package/`에 있습니다.

#### Drop-in 파일 복사 (3개)

```powershell
# 내부 Git에서 보안 패키지 가져오기
git clone http://<internal-git>/security/opencode-security-agent.git C:\temp\security-agent

# .opencode 디렉토리 생성 (없으면)
mkdir .opencode\prompts\agents -Force
mkdir .opencode\rules -Force
mkdir .opencode\commands -Force

# 파일 복사
copy C:\temp\security-agent\.opencode\prompts\agents\search-guard.md .opencode\prompts\agents\
copy C:\temp\security-agent\.opencode\rules\security-policy.md .opencode\rules\
copy C:\temp\security-agent\.opencode\commands\search-guard.md .opencode\commands\
```

#### opencode.json 병합 (3곳)

`%APPDATA%\opencode\opencode.json`을 열어 아래 3곳을 추가합니다.

**① instructions 배열에 추가:**

```diff
  "instructions": [
    "AGENTS.md",
    ".opencode/rules/common-rules.md",
    ...
+   ".opencode/rules/security-policy.md"
  ],
```

**② agent 객체에 추가:**

```diff
  "agent": {
    "build": { ... },
    ...
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

**③ command 객체에 추가:**

```diff
  "command": {
    "init": { ... },
    ...
+   "search-guard": {
+     "description": "보안 검토 후 외부 검색 실행 (민감정보 자동 일반화)",
+     "template": "{file:.opencode/commands/search-guard.md}\n\n$ARGUMENTS",
+     "agent": "search-guard",
+     "subtask": true
+   }
  },
```

> ⚠️ JSON 쉼표에 주의하세요. 마지막 항목 뒤에 쉼표가 없어야 합니다.

#### opencode 재시작

설정 변경 후 opencode를 완전히 종료하고 재시작합니다.

#### 사용 방법

```
> /search-guard Oracle DB TNS Listener ORA-12541 에러 해결 방법
```

search-guard 에이전트가 쿼리를 검토 후 Context7/Exa를 통해 검색합니다.
`security-policy.md`가 instructions에 포함되어 있으므로, **모든 에이전트**가 보안 정책을 인지합니다.

### 보안 아키텍처 (2계층 방어)

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

### 민감정보 일반화 예시

| 개발자 입력 | search-guard 변환 | 결과 |
|------------|-------------------|------|
| `10.10.20.30에서 ORA-12541 에러` | `Oracle DB 서버에서 ORA-12541 에러` | ✅ 검색 |
| `db-master 연결 실패 PostgreSQL` | `데이터베이스 서버 연결 실패 PostgreSQL` | ✅ 검색 |
| `900101-1234567 조회 API` | ⚠️ 검색 거부 (PII 포함) | ❌ 차단 |
| `FastAPI CORS 설정 방법` | 변환 없음 (안전) | ✅ 검색 |

---

## 4. 인증

개발자 PC의 MCP 서버는 **Proxy API Key**로 인증합니다.

```
개발자 PC → context7-mcp → Authorization: Bearer 727a179...
                         → Gateway 인증 통과 → 외부 검색 실행
```

- opencode.json의 `CONTEXT7_API_KEY`와 `EXA_API_KEY`는 이미 설정되어 있음 (전 개발자 공통)
- Gateway가 `Authorization: Bearer <key>` 또는 `X-API-Key: <key>`를 자동 검증
- **Keycloak 계정은 불필요**합니다 (Keycloak은 보안 포털 관리자 전용)

---

## 5. 동작 확인

### opencode에서 테스트

```
> "FastAPI에서 CORS 설정하는 방법 알려줘"
```

AI가 Context7 또는 Exa MCP 도구를 사용하면:
1. 요청이 Gateway로 전달됨
2. 민감정보 필터 검사 (차단 또는 통과)
3. 외부 서비스에서 결과 조회
4. 검색 로그 + 감사 로그 자동 기록

### 민감정보 차단 확인

```
> "900101-1234567 주민번호로 검색해줘"
```

→ Gateway가 요청을 **차단하고 403 반환**. 외부 서비스에 요청이 전달되지 않습니다.

### 사용 가능한 MCP 도구

| 도구 | 서비스 | 설명 |
|------|--------|------|
| `resolve-library-id` | Context7 | 라이브러리 ID 검색 |
| `query-docs` | Context7 | 기술 문서 조회 |
| `web_search_exa` | Exa | 웹 검색 |
| `crawling_exa` | Exa | URL 크롤링 |
| `get_code_context_exa` | Exa | 코드 관련 문서 검색 |

---

## 6. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `Connection refused` | Gateway 미실행 또는 IP 오류 | `ping <gateway-ip>`, IT 담당자에게 확인 |
| `401 Unauthorized` | API Key 불일치 | opencode.json의 API Key가 `727a179...`로 시작하는지 확인 |
| `403 Blocked` | 민감정보 필터 차단 | 검색어에서 IP, 주민번호, 계정정보 등 제거 |
| MCP 도구가 안 보임 | opencode 재시작 필요 | opencode 완전 종료 후 재시작 |
| Exa 검색이 안됨 | Exa 패치 미적용 | 위 패치 절차 재실행, `$ExaPath` 내용에 `EXA_BASE_URL` 포함 확인 |
| `npm install` 실패 | Nexus 연결 오류 | `npm config get registry`로 Nexus URL 확인 |
| 검색 결과가 이상함 | 민감정보 차단으로 검색어 변경 | IP 대신 에러 메시지/기술 키워드 중심으로 검색 |

---

## 7. 보안 안내

### 자동 보호

모든 검색 요청은 Gateway를 거치며, 아래 정보가 포함되면 **자동으로 차단**됩니다:

| 카테고리 | 예시 |
|----------|------|
| 개인식별정보 | 주민등록번호, 휴대폰번호, 이메일 |
| 내부 네트워크 | 사설 IP (`10.x.x.x`, `192.168.x.x`), 내부 도메인 |
| 인증 자격증명 | API Key, 비밀번호, DB 접속정보, AWS 키 |
| 금융 정보 | 신용카드번호, 계좌번호 |

### 효율적인 검색 팁

**비효율적** (차단됨):
```
10.10.20.30 서버에서 ORA-12541 에러 발생
```

**효율적** (정상 검색):
```
Oracle DB TNS Listener ORA-12541 에러 해결 방법
```

→ IP 대신 **서버 역할, 에러 메시지, 기술 키워드** 중심으로 검색하세요.

### 검색 이력 기록

모든 검색 요청은 보안 모니터링 목적으로 기록됩니다. 차단은 보안 위반이 아니라 **자동 보호** 기능입니다.

---

## 참조 문서

| 문서 | 설명 |
|------|------|
| [개발자 공지](developer-notice.md) | MCP Gateway 운영 안내 (전체 개발자 대상) |
| [보안 아키텍처](../architecture/04-security-agent.md) | 3계층 보안 설계 상세 |
