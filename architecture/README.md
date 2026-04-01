# MCP Gateway — Architecture Diagrams

## Stitch 프로젝트 (Google Stitch로 생성된 비주얼 다이어그램)

**프로젝트 URL**: https://stitch.withgoogle.com/project/16167240815562342620

### 생성된 화면 (4개)
1. **System Architecture** — 전체 시스템 구성도 (개발자 PC → Gateway → 외부 서비스)
2. **Network Topology** — 네트워크 토폴로지 (폐쇄망, DMZ, 외부)
3. **Content Filter Pipeline** — 양방향 콘텐츠 필터 파이프라인 (Request + Response)
4. **Frontend Feature Map** — 보안 담당자 포털 기능 맵

---

## 텍스트 기반 아키텍처 문서

- [01-system-architecture.md](./01-system-architecture.md) — 전체 시스템 구성
- [02-data-flow.md](./02-data-flow.md) — 양방향 필터링 요청 흐름
- [03-frontend-features.md](./03-frontend-features.md) — Frontend 기능 목록 (단독 IDP 기준)
- [04-security-agent.md](./04-security-agent.md) — 보안 아키텍처: 122B 내장 페르소나 + Gateway 마스킹 (별도 Agent 불필요)
