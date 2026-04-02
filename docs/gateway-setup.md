# MCP Gateway 서버 구축 가이드

**대상**: MCP Gateway를 RHEL 9.6 서버에 배포하는 인프라/보안 담당자  
**환경**: RHEL 9.6 + Podman + 인터넷 아웃바운드 가능

---

## 1. 사전 요구사항

### 1.1 서버 사양

| 항목 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| OS | RHEL 9.6 | RHEL 9.6 |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB | 50 GB (로그 저장량에 따라) |
| Network | 아웃바운드 허용 | 아웃바운드 허용 |

### 1.2 필수 패키지

```bash
# Podman + Compose 설치
sudo dnf install -y podman podman-compose

# Git 설치
sudo dnf install -y git

# 버전 확인
podman --version    # 4.x 이상
podman-compose --version
git --version
```

### 1.3 방화벽 설정

```bash
# 인바운드: 개발자 PC → Gateway (사내망)
sudo firewall-cmd --permanent --add-port=8000/tcp   # Backend API
sudo firewall-cmd --permanent --add-port=3000/tcp   # Frontend 포털
sudo firewall-cmd --permanent --add-port=8080/tcp   # Keycloak (포털 인증)

# 아웃바운드: Gateway → 외부 서비스 (인터넷)
# 방화벽 정책에서 아래 도메인 HTTPS(443) 아웃바운드 허용 필요:
#   - context7.com
#   - api.exa.ai

# 적용
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

> **주의**: 인바운드 포트는 사내망에서만 접근 가능해야 합니다.
> 외부에서 Gateway로의 인바운드 접근은 반드시 차단하세요.

---

## 2. 소스 배포

```bash
# Gateway 소스 클론
cd /opt
sudo git clone https://internal-git/security/mcp-gateway.git
cd mcp-gateway
```

---

## 3. 환경변수 설정

```bash
cd deploy
cp .env.example .env
vi .env
```

**필수 변경 항목:**

```bash
# .env 파일

# ─── DB (기본값 사용 가능, 운영 시 비밀번호 변경 권장) ───
POSTGRES_USER=mcp
POSTGRES_PASSWORD=<강력한_비밀번호>
POSTGRES_DB=mcp_gateway
MCP_GATEWAY_DATABASE_URL=postgresql+asyncpg://mcp:<강력한_비밀번호>@postgres:5432/mcp_gateway

# ─── Proxy API Key (개발자 PC 인증용 — 반드시 변경) ───
MCP_GATEWAY_PROXY_API_KEY=727a17912b5c1b79564ba42e59b47ae17dc65c82df35717adb14e75d0bb27b0b

# ─── Exa API Key (exa.ai 서비스 인증) ───
MCP_GATEWAY_EXA_API_KEY=<exa-api-key>

# ─── Keycloak 관리자 (포털 로그인용 — 반드시 변경) ───
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<강력한_비밀번호>
MCP_GATEWAY_KEYCLOAK_ADMIN_CLIENT_SECRET=mcp-gateway-admin-secret

# ─── 프록시 (사내 프록시가 있는 경우만) ───
# MCP_GATEWAY_HTTP_PROXY=http://proxy.corp.example:8080
# MCP_GATEWAY_HTTPS_PROXY=http://proxy.corp.example:8080

# ─── Frontend ───
NEXT_PUBLIC_API_URL=http://<이_서버_IP>:8000
NEXT_PUBLIC_KEYCLOAK_URL=http://<이_서버_IP>:8080
NEXT_PUBLIC_KEYCLOAK_REALM=mcp-gateway
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=mcp-gateway-web
NEXT_PUBLIC_DEV_MODE=false

# ─── 콘텐츠 필터 ───
MCP_GATEWAY_FILTER_ENABLED=true
```

---

## 4. 컨테이너 빌드 및 실행

```bash
cd /opt/mcp-gateway/deploy

# 컨테이너 빌드
podman-compose build

# 서비스 시작 (백그라운드)
podman-compose up -d

# 시작 상태 확인
podman-compose ps
```

정상 시작 시 4개 컨테이너가 `Up` 상태:

```
NAME                STATUS
deploy_postgres_1   Up (healthy)
deploy_keycloak_1   Up (healthy)
deploy_backend_1    Up
deploy_frontend_1   Up
```

> **Keycloak 초기 시작**: 최초 실행 시 realm import + DB 초기화로 1~2분 소요됩니다.
> `podman-compose logs -f keycloak`으로 `Running the server` 메시지를 확인하세요.

---

## 5. 서비스 확인

```bash
# Backend 헬스체크
curl -sf http://localhost:8000/health
# 기대 결과: {"status":"ok"}

# Frontend 접속 확인
curl -sf http://localhost:3000 -o /dev/null && echo "OK"

# Keycloak 확인
curl -sf http://localhost:8080/realms/mcp-gateway/.well-known/openid-configuration | head -1

# DB 접속 확인
podman exec deploy_postgres_1 psql -U mcp -d mcp_gateway -c "SELECT count(*) FROM filter_rules;"
# 기대 결과: 13 (기본 시드 규칙)
```

---

## 6. Keycloak 초기 설정

### 6.1 관리자 콘솔 접속

1. 브라우저에서 `http://<서버IP>:8080` 접속
2. `.env`에 설정한 `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`로 로그인

### 6.2 포털 관리자 계정 생성

1. 좌측 메뉴 → `mcp-gateway` realm 선택
2. Users → Add user
3. 정보 입력:
   - Username: 보안담당자 이름
   - Email: 이메일
   - Email Verified: ON
4. Credentials 탭 → Set password (Temporary: OFF)
5. Role Mappings → `admin` 역할 부여

### 6.3 Client Secret

`MCP_GATEWAY_KEYCLOAK_ADMIN_CLIENT_SECRET`은 `realm-export.json`에 미리 정의되어 있습니다.
Keycloak이 `--import-realm`으로 시작하면서 이 값을 그대로 사용하므로, `.env`에 아래 값을 설정하면 됩니다:

```
MCP_GATEWAY_KEYCLOAK_ADMIN_CLIENT_SECRET=mcp-gateway-admin-secret
```

> **참고**: `.env.example`에 이미 이 값이 포함되어 있습니다. `cp .env.example .env` 후 별도 수정 불필요.

---

## 7. 운영 명령어

```bash
cd /opt/mcp-gateway/deploy

# ─── 로그 확인 ───
podman-compose logs -f backend      # 백엔드 로그
podman-compose logs -f keycloak     # Keycloak 로그
podman-compose logs -f frontend     # 프론트엔드 로그
podman-compose logs --tail=100      # 전체 최근 100줄

# ─── 서비스 관리 ───
podman-compose restart backend      # 백엔드만 재시작
podman-compose restart              # 전체 재시작
podman-compose down                 # 전체 중지
podman-compose up -d                # 전체 시작

# ─── 업데이트 ───
cd /opt/mcp-gateway
git pull origin main
cd deploy
podman-compose build                # 이미지 재빌드
podman-compose up -d                # 재배포

# ─── DB 마이그레이션 (스키마 변경 시) ───
podman exec deploy_backend_1 alembic upgrade head

# ─── DB 백업 ───
podman exec deploy_postgres_1 pg_dump -U mcp mcp_gateway > backup_$(date +%Y%m%d).sql
```

---

## 8. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| Keycloak `unhealthy` | 초기 시작 시간 부족 | 2~3분 대기 후 재확인, `podman-compose logs -f keycloak` |
| Backend 시작 실패 | DB 연결 실패 | `.env`의 DB 비밀번호 확인, postgres 컨테이너 healthy 확인 |
| Frontend 빈 화면 | `NEXT_PUBLIC_API_URL` 오류 | `.env`에서 실제 서버 IP로 설정했는지 확인 |
| 외부 검색 timeout | 방화벽 아웃바운드 차단 | context7.com:443, api.exa.ai:443 허용 확인 |
| 개발자 PC 연결 거부 | 방화벽 인바운드 차단 | 8000번 포트 인바운드 허용 확인 |
| `401 Unauthorized` (개발자) | API Key 불일치 | `.env`의 `MCP_GATEWAY_PROXY_API_KEY`와 개발자 설정 일치 확인 |
| `401 Unauthorized` (포털) | Keycloak 토큰 만료 | 포털 로그아웃 후 재로그인 |

---

## 9. 보안 체크리스트

배포 후 아래 항목을 반드시 확인하세요:

- [ ] `.env` 파일 권한 제한: `chmod 600 .env`
- [ ] DB 비밀번호를 기본값(`mcp`)에서 변경
- [ ] Keycloak 관리자 비밀번호를 기본값(`admin`)에서 변경
- [ ] Proxy API Key를 충분히 긴 임의 문자열로 설정
- [ ] 방화벽 인바운드: 사내망에서만 8000, 3000, 8080 접근 가능
- [ ] 방화벽 아웃바운드: context7.com:443, api.exa.ai:443만 허용
- [ ] 기본 필터 규칙 13개 시드 확인: `curl http://localhost:8000/api/v1/filters` (DEV_MODE 시)
- [ ] 포털 로그인 정상 확인: `http://<서버IP>:3000`

---

## 참조 문서

| 문서 | 설명 |
|------|------|
| [개발자 PC 설정 가이드](developer-setup.md) | 개발자 PC에 opencode + MCP 서버 설정 |
| [보안 담당자 매뉴얼](security-officer-manual.md) | 포털 사용법 및 운영 가이드 |
| [개발자 공지](developer-notice.md) | 개발자 대상 MCP Gateway 안내문 |
| [보안 아키텍처](../architecture/04-security-agent.md) | 3계층 보안 설계 (페르소나 + Gateway + 감사) |
