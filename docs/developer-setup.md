# 개발자 PC 설정 가이드 (Windows 11)

## 사전 요구사항

- Windows 11
- Node.js 20+ 설치
- opencode CLI 설치

## 1. MCP 서버 설치

```powershell
npm install -g @anthropic/context7-mcp
npm install -g exa-mcp-server
```

## 2. opencode 설정

`%APPDATA%\opencode\opencode.json` 파일을 편집합니다:

```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/context7-mcp"],
      "env": {
        "CONTEXT7_API_URL": "http://<gateway-ip>:8000/proxy/c7"
      }
    },
    "exa": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_BASE_URL": "http://<gateway-ip>:8000/proxy/exa",
        "EXA_API_KEY": "managed-by-gateway"
      }
    }
  }
}
```

> `<gateway-ip>`를 MCP Gateway 서버의 IP 주소로 교체하세요.

## 3. 인증 설정

Gateway는 Keycloak JWT 인증을 사용합니다.
opencode에서 요청 시 Authorization 헤더에 Bearer 토큰을 포함해야 합니다.

토큰 획득 방법은 조직의 Keycloak 관리자에게 문의하세요.

## 4. 동작 확인

opencode에서 다음 도구를 사용할 수 있습니다:

- **resolve-library-id**: Context7 라이브러리 검색
- **query-docs**: Context7 기술 문서 조회
- **web_search_exa**: Exa 웹 검색

모든 요청은 MCP Gateway를 통해 외부 서비스로 전달되며,
검색 로그와 콘텐츠 필터가 적용됩니다.
