---
name: security-code-review
description: 코드 변경 시 민감정보 하드코딩 및 보안 취약점 탐지
triggers:
  - 코드 리뷰
  - PR 리뷰
  - 보안 점검
---

# 코드 보안 리뷰 절차

## 검사 항목

### 1. 하드코딩된 민감정보
- IP 주소 리터럴 (테스트 코드 제외)
- API 키, 토큰, 비밀번호 문자열
- DB 커넥션 스트링
- 내부 도메인 하드코딩

### 2. 보안 취약점 (OWASP 기준)
- SQL 인젝션 (raw query 사용 여부)
- XSS (사용자 입력 미이스케이프)
- 인증/인가 누락 (엔드포인트에 auth 의존성 없음)
- 에러 메시지에 내부 정보 노출

### 3. MCP Gateway 연동 관점
- 새 API 엔드포인트에 `get_current_user` 의존성 있는지
- 필터 규칙 변경 시 `docs/filter_rules.md` 동기화
- 프록시 경로 추가 시 `UPSTREAM_MAP` 업데이트

## 보고 형식

```
🔍 보안 리뷰 결과
- [CRITICAL] {파일}:{라인} — {문제 설명}
- [WARNING]  {파일}:{라인} — {문제 설명}
- [OK] 민감정보 하드코딩 없음
```
