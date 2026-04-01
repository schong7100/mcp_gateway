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
| 네트워크 | MCP Gateway 서버 접근 가능 (`http://<gateway-ip>:8000`) |

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

```json
{
  "mcp": {
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "environment": {
        "CONTEXT7_API_URL": "http://<gateway-ip>:8000/proxy/c7",
        "CONTEXT7_API_KEY": "<proxy-api-key>",
        "DEFAULT_MINIMUM_TOKENS": "5000"
      }
    },
    "exa": {
      "type": "local",
      "command": ["exa-mcp-server"],
      "environment": {
        "EXA_BASE_URL": "http://<gateway-ip>:8000/proxy/exa",
        "EXA_API_KEY": "<proxy-api-key>"
      }
    }
  }
}
```

**필수 변경:**
- `<gateway-ip>`: MCP Gateway 서버 IP (IT 담당자에게 확인)
- `<proxy-api-key>`: Gateway Proxy API Key (IT 담당자에게 발급)

> **참고**: `EXA_API_KEY`에도 Proxy API Key를 설정합니다. 실제 Exa API Key는 Gateway 서버에서 관리합니다.

> **기존 Nexus MCP 등 다른 MCP 서버가 이미 설정되어 있다면**, `"mcp"` 객체 안에 `"context7"`과 `"exa"` 항목만 추가하세요. 기존 설정을 덮어쓰지 않도록 주의합니다.

---

## 3. 보안 페르소나 배포 (CLAUDE.md)

보안 담당자가 관리하는 `CLAUDE.md` 파일을 프로젝트 루트에 배포합니다.
이 파일은 opencode가 외부 검색 시 민감 정보를 자동으로 일반화하도록 지시합니다.

### 자동 배포 (보안 담당자가 1회 실행)

```powershell
# 1. 보안 정책 저장소 클론
git clone https://internal-git/security/opencode-policy.git C:\opencode\security

# 2. 읽기 전용 설정 (개발자가 수정 불가)
icacls "C:\opencode\security\*" /deny "%USERNAME%:(W,D,DC)" /T

# 3. CLAUDE.md 심볼릭 링크 (프로젝트 루트에 연결)
mklink "C:\Users\%USERNAME%\projects\CLAUDE.md" "C:\opencode\security\CLAUDE.md"
```

### 수동 배포 (심볼릭 링크 불가 시)

보안 담당자에게 `CLAUDE.md` 파일을 전달받아 프로젝트 루트에 복사합니다.

```powershell
# 보안 담당자가 제공한 CLAUDE.md를 프로젝트 루트에 복사
copy \\fileserver\security\CLAUDE.md C:\Users\%USERNAME%\projects\CLAUDE.md

# 읽기 전용 설정
attrib +R "C:\Users\%USERNAME%\projects\CLAUDE.md"
```

### CLAUDE.md의 역할

| 동작 | 설명 |
|------|------|
| 서버 IP → "Linux 서버" | `10.20.30.40에서 에러` → `Linux 서버에서 에러` |
| 호스트명 → "데이터베이스 서버" | `db-master 연결 실패` → `데이터베이스 서버 연결 실패` |
| 프로젝트명 → 일반화 | `프로젝트 알파` → `결제 시스템` |
| 소프트웨어명 → 유지 | `FastAPI`, `PostgreSQL` → 그대로 검색 |

> 이 파일은 **0차 방어** (소프트 레이어)입니다. 설령 우회되더라도 Gateway의 정규식 필터(1차 방어)가 IP/PII를 차단합니다.

---

## 4. 인증

개발자 PC의 MCP 서버는 **Proxy API Key**로 인증합니다.

```
개발자 PC → context7-mcp → Authorization: Bearer <proxy-api-key>
                         → Gateway 인증 통과 → 외부 검색 실행
```

- opencode.json의 `CONTEXT7_API_KEY`와 `EXA_API_KEY`에 동일한 Proxy API Key를 설정
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
| `401 Unauthorized` | API Key 불일치 | opencode.json의 `CONTEXT7_API_KEY`, `EXA_API_KEY` 확인 |
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
