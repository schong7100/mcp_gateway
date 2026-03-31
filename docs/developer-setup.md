# 개발자 PC 설정 가이드

MCP Gateway를 통해 Context7, Exa 검색 서비스를 사용하는 방법입니다.
모든 검색 요청은 Gateway를 경유하며, 민감정보 필터링과 로그가 자동 적용됩니다.

---

## 사전 요구사항

- Node.js 20+ 설치
- opencode CLI 설치
- MCP Gateway 서버 접근 가능 (기본: `http://gateway:8000`)

## 1. MCP 서버 설치

```bash
# Context7 MCP (라이브러리 문서 검색)
npm install -g @upstash/context7-mcp

# Exa MCP (웹 검색)
npm install -g exa-mcp-server
```

### Exa MCP 패치 (필수)

exa-mcp-server는 API URL이 하드코딩되어 있어 패치가 필요합니다:

```bash
# exa-mcp-server 설치 경로 확인
EXA_PATH=$(npm root -g)/exa-mcp-server/.smithery/stdio/index.cjs

# 원본 백업
cp "$EXA_PATH" "${EXA_PATH}.bak"

# EXA_BASE_URL 환경변수 지원 패치
# macOS:
sed -i '' 's|e="https://api.exa.ai"|e=process.env.EXA_BASE_URL||"https://api.exa.ai"|g' "$EXA_PATH"
# Linux:
sed -i 's|e="https://api.exa.ai"|e=process.env.EXA_BASE_URL||"https://api.exa.ai"|g' "$EXA_PATH"
```

---

## 2. opencode 설정

opencode 설정 파일에 MCP 서버를 등록합니다.

**설정 파일 위치:**
- macOS: `~/.config/opencode/opencode.json`
- Linux: `~/.config/opencode/opencode.json`
- Windows: `%APPDATA%\opencode\opencode.json`

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
- `<gateway-ip>`: MCP Gateway 서버 IP (예: `10.20.30.100`, 로컬: `localhost`)
- `<proxy-api-key>`: Gateway 관리자에게 발급받은 Proxy API Key

---

## 3. 인증 방식

MCP Gateway는 2가지 인증을 지원합니다:

### A. Proxy API Key (MCP 서버용 — 권장)

MCP stdio 서버는 JWT를 보낼 수 없으므로, Proxy API Key를 사용합니다.
위 설정의 `CONTEXT7_API_KEY`와 `EXA_API_KEY`에 동일한 키를 설정하면
Gateway가 `Authorization: Bearer <key>` 또는 `X-API-Key: <key>`로 인증합니다.

```
개발자 PC → context7-mcp → Authorization: Bearer <proxy-api-key>
                         → Gateway 인증 통과 → upstream 호출
```

### B. Keycloak JWT (Frontend/API 직접 호출용)

브라우저에서 모니터링 포털(`http://gateway:3000`)에 접속하거나,
curl로 직접 API를 호출할 때는 Keycloak JWT를 사용합니다.

```bash
# 토큰 발급
TOKEN=$(curl -s -X POST http://<gateway-ip>:8080/realms/mcp-gateway/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=mcp-gateway-web&username=<your-username>&password=<your-password>" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

# API 호출
curl -H "Authorization: Bearer $TOKEN" http://<gateway-ip>:8000/api/v1/logs
```

---

## 4. 폐쇄망 프록시 설정

Gateway 서버가 외부 인터넷(context7.com, api.exa.ai)에 접근하기 위해
프록시가 필요한 경우, Gateway 서버의 환경변수를 설정합니다:

```bash
# Gateway 서버 (.env 또는 환경변수)
MCP_GATEWAY_HTTP_PROXY=http://proxy.corp.example:8080
MCP_GATEWAY_HTTPS_PROXY=http://proxy.corp.example:8080
```

개발자 PC에서는 프록시 설정이 **불필요**합니다.
MCP 요청은 Gateway로만 전송되고, Gateway가 프록시를 통해 외부에 접근합니다.

```
개발자 PC ──(사내망)──► Gateway ──(프록시)──► context7.com / api.exa.ai
```

---

## 5. 동작 확인

### opencode에서 테스트

```
> "FastAPI 보안 관련 자료 조사해줘"
```

AI가 context7 또는 exa MCP 도구를 사용하면:
1. 요청이 Gateway로 전달됨
2. 민감정보 필터 검사 (차단 또는 통과)
3. 외부 서비스에서 결과 조회
4. 응답 필터링 (IP 등 마스킹)
5. 검색 로그 + 감사 로그 자동 기록

### 민감정보 차단 확인

```
> "900101-1234567 주민번호로 검색해줘"
```

→ Gateway가 요청을 차단하고 403 반환. 검색 로그에 차단 내역 기록.

### 사용 가능한 MCP 도구

| 도구 | 서비스 | 설명 |
|------|--------|------|
| `resolve-library-id` | Context7 | 라이브러리 ID 검색 |
| `query-docs` | Context7 | 기술 문서 조회 |
| `web_search_exa` | Exa | 웹 검색 |
| `crawling_exa` | Exa | URL 크롤링 |
| `get_code_context_exa` | Exa | 코드 관련 문서 검색 |

---

## 6. 모니터링 포털

보안 담당자/관리자는 웹 포털에서 실시간 모니터링 가능:

- **대시보드**: `http://<gateway-ip>:3000/` — 오늘 검색/차단 통계
- **검색 로그**: `http://<gateway-ip>:3000/logs` — 전체 검색 이력
- **필터 관리**: `http://<gateway-ip>:3000/filters` — 필터 규칙 CRUD (admin)
- **감사 로그**: `http://<gateway-ip>:3000/audit` — 감사 추적
- **사용자 관리**: `http://<gateway-ip>:3000/users` — Keycloak 사용자 (admin)

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `Connection refused` | Gateway 미실행 | Gateway 서버 상태 확인 |
| `401 Unauthorized` | API key 잘못됨 | `CONTEXT7_API_KEY` / `EXA_API_KEY` 확인 |
| `403 Blocked` | 민감정보 필터 매치 | 검색어에서 PII/인증정보 제거 |
| MCP 도구 안 보임 | opencode 재시작 필요 | opencode 종료 후 재시작 |
| Exa 검색 안됨 | 패치 미적용 | Exa MCP 패치 절차 재확인 |
