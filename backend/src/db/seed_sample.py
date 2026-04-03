"""샘플 검색 로그 및 감사 로그 시드 데이터.

Usage:
    python -m src.db.seed_sample
"""

import asyncio
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import AuditTrail, SearchLog
from src.db.session import async_session_factory

USERS = [
    ("ip:10.1.10.101", "10.1.10.101"),
    ("ip:10.1.10.102", "10.1.10.102"),
    ("ip:10.1.10.103", "10.1.10.103"),
    ("ip:10.1.10.104", "10.1.10.104"),
    ("ip:10.1.10.105", "10.1.10.105"),
]

C7_PATHS = [
    "libs/search",
    "libs/typescript/resolve",
    "libs/python/resolve",
    "libs/react/resolve",
]

EXA_PATHS = [
    "search",
    "contents",
    "findSimilar",
]

C7_REQUESTS = [
    {"query": "react useState best practices"},
    {"query": "fastapi dependency injection"},
    {"query": "sqlalchemy async session"},
    {"query": "typescript generics tutorial"},
    {"query": "python logging configuration"},
    {"query": "nextjs app router migration"},
    {"query": "tailwind css grid layout"},
    {"query": "postgresql jsonb indexing"},
]

EXA_REQUESTS = [
    {"query": "kubernetes pod networking explained"},
    {"query": "redis caching patterns 2025"},
    {"query": "oauth2 pkce flow implementation"},
    {"query": "docker compose healthcheck best practices"},
]

BLOCKED_REQUESTS = [
    {
        "request": {"body": {"query": "서버 비밀번호 192.168.1.100 접속 방법"}},
        "filter_details": {
            "direction": "request",
            "matches": [
                {"rule_id": "seed", "rule_name": "사설 IP 대역", "rule_type": "regex", "matched_text": "192.168.1.100"},
                {"rule_id": "seed", "rule_name": "민감 키워드", "rule_type": "keyword", "matched_text": "비밀번호"},
            ],
        },
    },
    {
        "request": {"body": {"query": "admin password reset token generation"}},
        "filter_details": {
            "direction": "request",
            "matches": [
                {"rule_id": "seed", "rule_name": "민감 키워드", "rule_type": "keyword", "matched_text": "password"},
            ],
        },
    },
    {
        "request": {"body": {"query": "connect to postgres://admin:secret@db.internal:5432"}},
        "filter_details": {
            "direction": "request",
            "matches": [
                {"rule_id": "seed", "rule_name": "DB 접속 정보", "rule_type": "regex", "matched_text": "postgres://admin:secret@db.internal:5432"},
                {"rule_id": "seed", "rule_name": "내부 도메인", "rule_type": "regex", "matched_text": "db.internal"},
            ],
        },
    },
]


async def seed_sample_data(db: AsyncSession) -> int:
    now = datetime.now(tz=UTC)
    added = 0

    # 정상 검색 로그 14건 (최근 24시간에 분산)
    for i in range(14):
        minutes_ago = random.randint(10, 1400)
        created = now - timedelta(minutes=minutes_ago)
        user_id, user_name = random.choice(USERS)

        is_c7 = random.random() < 0.6
        service = "c7" if is_c7 else "exa"
        path = random.choice(C7_PATHS if is_c7 else EXA_PATHS)
        request_body = random.choice(C7_REQUESTS if is_c7 else EXA_REQUESTS)

        log = SearchLog(
            user_id=user_id,
            user_name=user_name,
            service=service,
            method="POST",
            path=path,
            request_body=request_body,
            response_status=200,
            response_body={"result_count": random.randint(1, 25)},
            filtered=False,
            filter_details=None,
            created_at=created,
        )
        db.add(log)

        audit = AuditTrail(
            user_id=user_id,
            user_name=user_name,
            action="search",
            resource_type="proxy",
            resource_id=f"{service}/{path}",
            details={"method": "POST"},
            created_at=created,
        )
        db.add(audit)
        added += 1

    # 차단된 검색 로그 3건
    for i, blocked in enumerate(BLOCKED_REQUESTS):
        minutes_ago = random.randint(30, 1200)
        created = now - timedelta(minutes=minutes_ago)
        user_id, user_name = random.choice(USERS)
        service = random.choice(["c7", "exa"])

        log = SearchLog(
            user_id=user_id,
            user_name=user_name,
            service=service,
            method="POST",
            path="libs/search" if service == "c7" else "search",
            request_body=blocked["request"],
            response_status=403,
            response_body={"error": "Blocked by content filter"},
            filtered=True,
            filter_details=blocked["filter_details"],
            created_at=created,
        )
        db.add(log)

        audit = AuditTrail(
            user_id=user_id,
            user_name=user_name,
            action="search_blocked",
            resource_type="proxy",
            resource_id=f"{service}/search",
            details={
                "method": "POST",
                "blocked_rules": [m["rule_name"] for m in blocked["filter_details"]["matches"]],
            },
            created_at=created,
        )
        db.add(audit)
        added += 1

    # 필터 규칙 변경 감사 로그 3건
    filter_actions = [
        ("filter_create", "filter_rule", "주민등록번호 패턴 추가"),
        ("filter_update", "filter_rule", "민감 키워드 목록 갱신"),
        ("filter_toggle", "filter_rule", "이메일 주소 필터 비활성화"),
    ]
    for action, resource_type, detail_msg in filter_actions:
        minutes_ago = random.randint(60, 2000)
        created = now - timedelta(minutes=minutes_ago)

        audit = AuditTrail(
            user_id="ip:10.1.10.101",
            user_name="10.1.10.101",
            action=action,
            resource_type=resource_type,
            resource_id=f"rule-{random.randint(1, 12)}",
            details={"description": detail_msg},
            created_at=created,
        )
        db.add(audit)
        added += 1

    await db.commit()
    return added


async def main() -> None:
    async with async_session_factory() as db:
        added = await seed_sample_data(db)
        print(f"[seed_sample] {added}건 샘플 데이터 추가 완료")


if __name__ == "__main__":
    asyncio.run(main())
