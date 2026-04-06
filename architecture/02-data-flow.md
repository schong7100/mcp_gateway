# 양방향 필터링 요청 흐름

## 변경사항
- **기존**: 응답(response)만 필터링
- **변경**: 요청(request) + 응답(response) 양방향 필터링
- 요청에 민감 정보 포함 시 **403 차단** (업스트림 전달하지 않음)
- 응답에 민감 정보 포함 시 **[REDACTED] 마스킹** 후 전달

## 요청 흐름

```mermaid
sequenceDiagram
    participant Dev as 개발자 PC
    participant Auth as JWT 인증
    participant ReqF as 요청 필터
    participant Proxy as Reverse Proxy
    participant ResF as 응답 필터
    participant DB as PostgreSQL
    participant Up as context7.com

    Dev->>Auth: POST /proxy/c7/libs/search<br/>Authorization: Bearer {JWT}

    alt JWT 무효
        Auth-->>Dev: 401 Unauthorized
    end

    Auth->>ReqF: 인증된 요청 전달

    Note over ReqF: 요청 본문에서<br/>민감 패턴 검사

    alt 요청에 민감 정보 감지
        ReqF->>DB: 차단 로그 기록
        ReqF-->>Dev: 403 Blocked<br/>{"error": "Content filter blocked"}
    end

    ReqF->>Proxy: 통과 → 업스트림 전달
    Proxy->>Up: HTTPS POST /api/v2/libs/search
    Up-->>Proxy: 200 OK (검색 결과)

    Proxy->>ResF: 응답 본문 검사

    Note over ResF: 응답 본문에서<br/>민감 패턴 검사

    alt 응답에 민감 정보 감지
        ResF->>ResF: 매칭 텍스트 → [REDACTED]
        ResF->>DB: 필터링 상세 기록
    end

    ResF->>DB: SearchLog + AuditTrail 저장
    ResF-->>Dev: 200 OK (필터링된 응답)
```

## 필터 파이프라인 상세

```mermaid
flowchart TD
    subgraph REQ["요청 필터 (Request)"]
        R1[요청 본문 수신] --> R2[DB에서 활성 규칙 로드]
        R2 --> R3{regex 매칭?}
        R3 -->|Yes| R_BLOCK[403 차단 + 로그]
        R3 -->|No| R4{keyword 매칭?}
        R4 -->|Yes| R_BLOCK
        R4 -->|No| R_PASS[업스트림 전달]
    end

    subgraph RES["응답 필터 (Response)"]
        S1[응답 본문 수신] --> S2[DB에서 활성 규칙 로드]
        S2 --> S3{regex 매칭?}
        S3 -->|Yes| S_MATCH[매칭 기록]
        S3 -->|No| S4{keyword 매칭?}
        S_MATCH --> S4
        S4 -->|Yes| S_MATCH2[매칭 기록]
        S4 -->|No| S_RESULT{매칭 있음?}
        S_MATCH2 --> S_RESULT
        S_RESULT -->|Yes| S_REDACT["[REDACTED] 마스킹"]
        S_RESULT -->|No| S_PASS[원본 전달]
    end

    R_PASS --> S1

    style R_BLOCK fill:#ffcdd2,stroke:#c62828
    style S_REDACT fill:#fff9c4,stroke:#f57f17
    style R_PASS fill:#c8e6c9,stroke:#2e7d32
    style S_PASS fill:#c8e6c9,stroke:#2e7d32
```

## 필터 규칙 예시

| 이름 | 유형 | 패턴 | 방향 | 동작 |
|------|------|------|------|------|
| 주민등록번호 | regex | `\d{6}-[1-4]\d{6}` | both | 요청: 차단, 응답: 마스킹 |
| IP 주소 | regex | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}` | response | 응답만 마스킹 |
| 민감 키워드 | keyword | `credential,private_key,비밀번호,passwd` | both | 요청: 차단, 응답: 마스킹 |
| 자격증명 할당문 | regex | `(?i)(?:password\|token\|secret\|api_key)\s*[=:]\s*\S+` | both | 값 할당 패턴만 탐지 |
| 내부 도메인 | keyword | `internal.corp.com,admin.local` | response | 응답만 마스킹 |
