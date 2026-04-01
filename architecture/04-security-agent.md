# 보안 AI Agent 아키텍처

## 1. 개요

MCP Gateway의 3계층 보안 아키텍처를 정의합니다.
개발자 PC에서 외부 검색(Context7, Exa)을 요청할 때, 민감 정보가 외부로 유출되지 않도록
**AI 기반 문맥 판단**과 **규칙 기반 패턴 차단**을 이중으로 적용합니다.

---

## 2. 3계층 보안 아키텍처

```
개발자 질문
    ↓
opencode (Claude/Qwen 122B)
    ↓ MCP 검색 호출 시도
    ↓
┌──────────────────────────────────────────┐
│ [1차] 보안 AI Agent (7B, pre-hook)       │
│                                          │
│  한글 보안 지침 기반 문맥 판단            │
│  ├── PASS  → 다음 계층으로 전달          │
│  ├── WARN  → 경고 로그 + 전달            │
│  └── BLOCK → 즉시 차단, 개발자에게 안내   │
└──────────────────────────────────────────┘
    ↓ (PASS / WARN)
┌──────────────────────────────────────────┐
│ [2차] MCP Gateway regex 필터             │
│                                          │
│  패턴 기반 강제 차단 (13개 규칙)          │
│  ├── 통과 → upstream 검색 실행           │
│  └── 차단 → 403 응답                     │
└──────────────────────────────────────────┘
    ↓ (통과)
┌──────────────────────────────────────────┐
│ [3차] Gateway 감사 로그                  │
│                                          │
│  모든 요청/응답 기록 → PostgreSQL         │
│  보안 담당자 Frontend 포털에서 조회       │
└──────────────────────────────────────────┘
    ↓
외부 검색 (context7.com / api.exa.ai)
```

---

## 3. 각 계층의 역할과 특성

| 계층 | 방식 | 우회 가능 | 잡는 것 | 못 잡는 것 |
|------|------|----------|---------|-----------|
| **1차: 보안 AI Agent** | LLM 문맥 판단 | ❌ 별도 프로세스 | 사내 프로젝트명, 직원 정보, 비즈니스 로직, 의도 분석 | 새로운 패턴의 개인정보 (학습 안 된 형식) |
| **2차: Gateway regex** | 정규식 패턴 매칭 | ❌ 서버 사이드 | 주민번호, IP, API키, 이메일, 휴대폰 등 정형 패턴 | 문맥 기반 기밀 (비정형) |
| **3차: 감사 로그** | 전수 기록 | ❌ 서버 사이드 | 사후 감사, 이상 패턴 탐지 | 실시간 차단 불가 (사후 분석) |

### 상호 보완 관계

```
             문맥 이해 ↑
                       │
  1차 보안 AI Agent ●  │  ← "프로젝트 알파 DB 스키마 찾아줘"
                       │  ← "김과장 연봉 정보"
                       │  ← "우리 회사 고객사 목록"
                       │
                       │
  2차 Gateway regex    │  ● ← 주민번호: \d{6}-[1-4]\d{6}
                       │  ← 사설IP: 10.x.x.x
                       │  ← API키: AKIA...
                       │
              패턴 정확도 →
```

---

## 4. 보안 AI Agent 상세 설계

### 4.1 모델 선정

| 항목 | 선정 |
|------|------|
| **모델** | Qwen2.5 7B (한국어 성능 우수) 또는 Llama 3.1 8B |
| **런타임** | Ollama (CPU 구동, GPU 선택적) |
| **리소스** | RAM 8GB, 디스크 5GB (모델 파일) |
| **응답 시간** | CPU: 2~5초, GPU: 0.5~1초 |
| **배포** | Podman 컨테이너 (MCP Gateway와 동일 네트워크) |

### 4.2 배포 구성

```yaml
# deploy/podman-compose.yml
security-agent:
  image: ollama/ollama:latest
  container_name: mcp-security-agent
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  restart: unless-stopped
  deploy:
    resources:
      limits:
        memory: 8G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
    interval: 30s
    timeout: 10s
    retries: 3
```

```bash
# 모델 설치 (인터넷 환경에서 다운로드 후 폐쇄망 이동)
ollama pull qwen2.5:7b

# 폐쇄망 이동 방법
# 1. ~/.ollama/models/ 디렉토리를 USB/네트워크로 복사
# 2. 폐쇄망 서버의 ollama_data 볼륨에 배치
```

### 4.3 보안 검토 API

```
POST http://security-agent:11434/api/generate
Content-Type: application/json

{
  "model": "qwen2.5:7b",
  "prompt": "[보안 지침]\n{security_policy}\n\n[검토 대상]\n{query}\n\n[판정]",
  "stream": false,
  "format": "json"
}
```

**응답 형식:**
```json
{
  "decision": "PASS",
  "reason": "일반적인 기술 질문",
  "detected": []
}
```

```json
{
  "decision": "BLOCK",
  "reason": "사내 프로젝트 코드명 '프로젝트 알파'가 포함됨",
  "detected": ["프로젝트 알파"]
}
```

```json
{
  "decision": "WARN",
  "reason": "CVE 취약점과 특정 버전 조합 — 공격 벡터 탐색 가능성",
  "detected": ["CVE-2024-1234", "Apache 2.4.49"]
}
```

### 4.4 pre-hook 연동

```
opencode.json hooks 설정
    ↓
MCP 도구 호출 전 (context7, exa)
    ↓
security-check.sh 실행
    ↓
Ollama API 호출 → 판정
    ↓
BLOCK → exit 1 (호출 차단)
WARN  → 경고 출력 + exit 0 (통과)
PASS  → exit 0 (통과)
```

**security-check.sh (개발자 PC에 배포):**
```bash
#!/bin/bash
# MCP 도구 호출 전 보안 검토 스크립트
# opencode pre-hook으로 등록

SECURITY_AGENT_URL="http://gateway-server:11434/api/generate"
QUERY="$1"

RESULT=$(curl -s -X POST "$SECURITY_AGENT_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"qwen2.5:7b\",
    \"prompt\": \"$(cat /etc/opencode/security-policy.txt)\\n\\n[검토 대상]\\n${QUERY}\\n\\n[판정]\",
    \"stream\": false,
    \"format\": \"json\"
  }")

DECISION=$(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(json.load(sys.stdin)['response'])['decision'])")

case "$DECISION" in
  BLOCK)
    echo "⛔ 보안 검토 차단: $(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(json.load(sys.stdin)['response'])['reason'])")"
    exit 1
    ;;
  WARN)
    echo "⚠️ 보안 경고: $(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(json.load(sys.stdin)['response'])['reason'])")"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
```

**보안 강화:**
```bash
# 스크립트를 읽기 전용으로 설정 (개발자 수정 방지)
chmod 444 /etc/opencode/security-check.sh
chmod 444 /etc/opencode/security-policy.txt
chown root:root /etc/opencode/security-check.sh
```

---

## 5. 한글 보안 지침 (security-policy.txt)

보안 AI Agent가 참조하는 판단 기준입니다.
보안 담당자가 한글로 작성하고, 7B 모델이 이를 해석하여 판정합니다.

```
당신은 폐쇄망 환경의 보안 검토 에이전트입니다.
개발자가 외부 검색 API로 보내려는 쿼리를 검토하여 민감 정보 유출을 방지합니다.

## 즉시 차단 (BLOCK)

### 사내 기밀
- 사내 프로젝트명, 코드명, 내부 제품명이 포함된 검색
- 고객사명, 협력사명, 계약 정보가 포함된 검색
- 사내 조직도, 부서 구조, 인사 정보가 포함된 검색
- 미공개 기능, 출시 일정, 사업 전략이 포함된 검색
- 사내 시스템 URL, 내부 도메인, 서버 호스트명이 포함된 검색

### 개인정보
- 특정 직원의 실명 + 직급/부서/연봉 등 개인정보 조합
- 고객의 실명, 연락처, 주소 등 개인정보

### 보안 위협
- 사내 시스템의 특정 버전 + 취약점 조합 (공격 벡터 탐색)
- 보안 장비/정책 우회 방법 검색
- 악성코드 제작, 역공학, 침투 테스트 관련 검색 (승인 없는 경우)

## 주의 관찰 — WARN (통과하되 로그 기록)
- 에러 로그에 포함된 사내 파일 경로 (디렉토리 구조 노출 가능)
- 짧은 시간에 동일 주제 대량 반복 검색 (정보 수집 패턴)
- 특정 기술의 보안 취약점만 집중 검색하는 경우

## 통과 — PASS
- 일반적인 프로그래밍 질문, 라이브러리 사용법
- 공개된 기술 문서, 오픈소스 프로젝트 검색
- 에러 메시지 해결, 디버깅 방법 검색
- 표준 프레임워크, 언어 문법, API 레퍼런스 검색

## 판정 규칙
1. 의심스러우면 BLOCK — 오탐이 미탐보다 낫다
2. 기술 용어와 사내 고유명사를 구분하라
3. 일반적인 단어라도 사내 맥락에서 기밀이 될 수 있다
4. BLOCK 시 반드시 이유와 감지된 항목을 명시하라

## 응답 형식 (JSON만 출력, 다른 텍스트 금지)
{"decision": "PASS|WARN|BLOCK", "reason": "판단 근거 (한국어)", "detected": ["감지된 항목 목록"]}
```

---

## 6. 우회 방지 전략

| 우회 시도 | 방어 수단 |
|----------|----------|
| pre-hook 스크립트 삭제/수정 | `chmod 444 + chown root` — 일반 사용자 수정 불가 |
| opencode 설정에서 hook 제거 | 글로벌 설정 파일 읽기 전용 + 파일 변경 모니터링 (inotifywait) |
| 직접 curl로 Gateway 호출 | Gateway API key는 보안 담당자만 관리, 개발자에게 미공개 |
| 프롬프트 인젝션으로 7B 우회 | 7B는 별도 프로세스 — 프롬프트가 격리됨. 추가로 Gateway regex가 2차 방어 |
| 보안 지침 파일 수정 | `/etc/opencode/security-policy.txt` root 소유, 읽기 전용 |
| 새 MCP 서버 직접 설치 | 폐쇄망 — 외부 패키지 설치 불가. 내부 저장소에서만 설치 가능 |

---

## 7. 모니터링 및 운영

### 보안 이벤트 흐름

```
보안 AI Agent
    ├── BLOCK → Gateway 감사 로그 API 호출 (POST /api/v1/audit)
    │           action: "security_agent_block"
    │           details: { decision, reason, detected, query }
    │
    ├── WARN  → Gateway 감사 로그 API 호출
    │           action: "security_agent_warn"
    │
    └── PASS  → 로그 없음 (정상 트래픽)
```

### 보안 담당자 대시보드 확장 (향후)

| 지표 | 설명 |
|------|------|
| 보안 Agent 차단 건수 | 1차 AI 판단으로 차단된 횟수 |
| Gateway 차단 건수 | 2차 regex로 차단된 횟수 |
| 이중 차단 건수 | 1차 통과 → 2차 차단 (AI 오탐 분석용) |
| WARN 건수 | 주의 관찰 대상 — 패턴 분석 필요 |
| 사용자별 차단 비율 | 특정 개발자의 이상 행동 감지 |

---

## 8. 구현 로드맵

| 단계 | 작업 | 선행 조건 | 예상 공수 |
|------|------|----------|----------|
| **Phase 1** | Ollama + Qwen2.5 7B 컨테이너 배포 | Podman 환경 | 2시간 |
| **Phase 2** | 보안 검토 API 서버 (FastAPI 래퍼) | Phase 1 | 3시간 |
| **Phase 3** | security-check.sh pre-hook 스크립트 | Phase 2 | 2시간 |
| **Phase 4** | 한글 보안 지침 작성 + 보안 담당자 검토 | — | 1시간 |
| **Phase 5** | Gateway 감사 로그 연동 | Phase 2-3 | 2시간 |
| **Phase 6** | 개발자 PC 배포 + 테스트 | Phase 1-5 | 3시간 |
| **Phase 7** | 대시보드 보안 지표 추가 (선택) | Phase 5 | 4시간 |

**총 예상 공수: ~17시간 (2~3일)**

---

## 9. 제약 사항 및 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 7B 모델 오탐 (정상 쿼리 차단) | 개발 생산성 저하 | WARN 우선 운영 → 안정화 후 BLOCK 전환 |
| 7B 미탐 (기밀 통과) | 정보 유출 | Gateway regex가 2차 방어 |
| Ollama 서버 장애 | 검색 전체 차단 | healthcheck + 장애 시 Gateway만으로 운영 (fallback) |
| 응답 지연 (CPU 2~5초) | 개발자 체감 속도 저하 | GPU 배포 또는 경량 모델(3B)로 대체 |
| 모델 업데이트 | 폐쇄망 재배포 필요 | USB/내부망 전송 프로세스 수립 |
