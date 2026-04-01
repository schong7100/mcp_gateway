"""보안 분석 리포트 API.

감사 로그와 검색 로그를 집계하여 AI 분석에 최적화된
구조화된 텍스트 리포트를 생성합니다.
"""

import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.db.models import AuditTrail, FilterRule, SearchLog
from src.db.session import get_db

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def _parse_period(period: str) -> datetime:
    unit = period[-1]
    value = int(period[:-1])
    if unit == "d":
        return datetime.now(tz=UTC) - timedelta(days=value)
    if unit == "h":
        return datetime.now(tz=UTC) - timedelta(hours=value)
    raise ValueError(f"Unsupported period format: {period}")


@router.get("/security", response_class=PlainTextResponse)
async def security_report(
    period: str = Query(default="7d", pattern=r"^\d+[dh]$"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    """보안 분석 리포트를 생성합니다. AI에게 전달하기 최적화된 텍스트 형식."""
    since = _parse_period(period)
    now = datetime.now(tz=UTC)

    lines: list[str] = []
    lines.append(f"# 보안 분석 리포트 ({since.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')})")
    lines.append("")

    # --- 1. 전체 요약 ---
    total_result = await db.execute(
        select(func.count(SearchLog.id)).where(SearchLog.created_at >= since)
    )
    total = total_result.scalar_one()

    blocked_result = await db.execute(
        select(func.count(SearchLog.id)).where(
            SearchLog.created_at >= since,
            SearchLog.response_status == 403,
        )
    )
    blocked = blocked_result.scalar_one()

    active_rules_result = await db.execute(
        select(func.count(FilterRule.id)).where(FilterRule.enabled.is_(True))
    )
    active_rules = active_rules_result.scalar_one()

    block_rate = (blocked / total * 100) if total > 0 else 0
    lines.append("## 1. 전체 요약")
    lines.append(f"- 총 검색 요청: {total}건")
    lines.append(f"- 차단: {blocked}건 ({block_rate:.1f}%)")
    lines.append(f"- 활성 필터 규칙: {active_rules}개")
    lines.append("")

    # --- 2. 유저별 차단 랭킹 ---
    user_block_result = await db.execute(
        select(
            SearchLog.user_id,
            SearchLog.user_name,
            func.count(SearchLog.id).label("total_requests"),
            func.sum(case((SearchLog.response_status == 403, 1), else_=0)).label("blocked_count"),
        )
        .where(SearchLog.created_at >= since)
        .group_by(SearchLog.user_id, SearchLog.user_name)
        .order_by(func.sum(case((SearchLog.response_status == 403, 1), else_=0)).desc())
        .limit(10)
    )
    user_blocks = user_block_result.all()

    lines.append("## 2. 유저별 활동 (차단 기준 상위 10명)")
    lines.append("| # | 유저 | 총 요청 | 차단 | 차단율 |")
    lines.append("|---|------|---------|------|--------|")
    for i, row in enumerate(user_blocks, 1):
        rate = (row.blocked_count / row.total_requests * 100) if row.total_requests > 0 else 0
        line = (
            f"| {i} | {row.user_name} ({row.user_id})"
            f" | {row.total_requests} | {row.blocked_count} | {rate:.1f}% |"
        )
        lines.append(line)
    lines.append("")

    # --- 3. 차단 규칙별 트리거 횟수 ---
    blocked_logs_result = await db.execute(
        select(AuditTrail.details).where(
            AuditTrail.created_at >= since,
            AuditTrail.action == "search_blocked",
        )
    )
    rule_counter: dict[str, int] = {}
    for (details,) in blocked_logs_result.all():
        if details and "blocked_rules" in details:
            for rule_name in details["blocked_rules"]:
                rule_counter[rule_name] = rule_counter.get(rule_name, 0) + 1

    lines.append("## 3. 차단 규칙별 트리거 횟수")
    if rule_counter:
        for rule_name, count in sorted(rule_counter.items(), key=lambda x: -x[1]):
            lines.append(f"- {rule_name}: {count}회")
    else:
        lines.append("- (차단 기록 없음)")
    lines.append("")

    # --- 4. 차단된 검색 상세 (최근 50건) ---
    blocked_detail_result = await db.execute(
        select(SearchLog)
        .where(
            SearchLog.created_at >= since,
            SearchLog.filtered.is_(True),
        )
        .order_by(SearchLog.created_at.desc())
        .limit(50)
    )
    blocked_logs = blocked_detail_result.scalars().all()

    lines.append("## 4. 차단된 검색 상세 (최근 50건)")
    if blocked_logs:
        for log in blocked_logs:
            time_str = log.created_at.strftime("%m-%d %H:%M")
            matches_str = ""
            if log.filter_details and "matches" in log.filter_details:
                match_items = [
                    f"{m.get('rule_name', '?')}='{m.get('matched_text', '?')}'"
                    for m in log.filter_details["matches"]
                ]
                matches_str = ", ".join(match_items)
            request_summary = _summarize_request(log.request_body)
            line = (
                f"- [{time_str}] {log.user_name}"
                f" | {log.service}/{log.path}"
                f" | {request_summary} | 매칭: {matches_str}"
            )
            lines.append(line)
    else:
        lines.append("- (차단 기록 없음)")
    lines.append("")

    # --- 5. 주의 패턴: Burst 탐지 ---
    lines.append("## 5. 주의 패턴 — 단시간 반복 차단 (30분 내 3회+)")
    burst_users = await _detect_burst_blocks(db, since, window_minutes=30, threshold=3)
    if burst_users:
        for user_name, incidents in burst_users.items():
            for incident in incidents:
                header = (
                    f"### {user_name}"
                    f" — {incident['start']} ~ {incident['end']}"
                    f" ({incident['count']}건)"
                )
                lines.append(header)
                for entry in incident["entries"]:
                    lines.append(f"  - {entry}")
    else:
        lines.append("- (탐지된 burst 패턴 없음)")
    lines.append("")

    # --- 6. 통과 쿼리 샘플 (AI 판단용) ---
    passed_result = await db.execute(
        select(SearchLog)
        .where(
            SearchLog.created_at >= since,
            SearchLog.filtered.is_(False),
            SearchLog.response_status != 403,
        )
        .order_by(func.random())
        .limit(20)
    )
    passed_logs = passed_result.scalars().all()

    lines.append("## 6. 통과 쿼리 샘플 (무작위 20건 — 이상 여부 AI 판단 필요)")
    for log in passed_logs:
        time_str = log.created_at.strftime("%m-%d %H:%M")
        request_summary = _summarize_request(log.request_body)
        line = (
            f"- [{time_str}] {log.user_name}"
            f" | {log.service}/{log.path} | {request_summary}"
        )
        lines.append(line)
    lines.append("")

    lines.append("---")
    lines.append("이 리포트를 AI에게 전달하여 다음을 분석해주세요:")
    lines.append("1. 반복 차단 유저 중 의도적 우회 시도가 의심되는 패턴")
    lines.append("2. 통과 쿼리 중 비정형 기밀(프로젝트명, 고객사명 등)이 포함된 건")
    lines.append("3. 차단 후 쿼리를 변형하여 재시도한 흔적")
    lines.append("4. 비정상적 시간대/빈도의 검색 활동")

    return "\n".join(lines)


def _summarize_request(request_body: dict | None) -> str:
    """요청 본문을 한 줄 요약합니다."""
    if not request_body:
        return "(본문 없음)"
    parts = []
    if "query_params" in request_body:
        params = request_body["query_params"]
        if isinstance(params, dict):
            for k, v in list(params.items())[:3]:
                parts.append(f"{k}={v}")
    if "body" in request_body:
        body = request_body["body"]
        if isinstance(body, dict):
            body_str = json.dumps(body, ensure_ascii=False)
            if len(body_str) > 100:
                body_str = body_str[:100] + "..."
            parts.append(body_str)
        elif isinstance(body, str):
            parts.append(body[:100])
    if "body_length" in request_body:
        parts.append(f"(binary {request_body['body_length']}B)")
    return " | ".join(parts) if parts else "(파싱 불가)"


async def _detect_burst_blocks(
    db: AsyncSession,
    since: datetime,
    window_minutes: int = 30,
    threshold: int = 3,
) -> dict[str, list[dict]]:
    """단시간 내 반복 차단(burst)을 탐지합니다."""
    result = await db.execute(
        select(SearchLog)
        .where(
            SearchLog.created_at >= since,
            SearchLog.filtered.is_(True),
        )
        .order_by(SearchLog.user_id, SearchLog.created_at)
    )
    blocked_logs = result.scalars().all()

    # 유저별로 그룹화
    user_logs: dict[str, list[SearchLog]] = {}
    for log in blocked_logs:
        user_logs.setdefault(log.user_name, []).append(log)

    burst_results: dict[str, list[dict]] = {}
    window = timedelta(minutes=window_minutes)

    for user_name, logs in user_logs.items():
        i = 0
        while i < len(logs):
            # 윈도우 내 차단 건수 계산
            window_end = logs[i].created_at + window
            j = i
            while j < len(logs) and logs[j].created_at <= window_end:
                j += 1

            if j - i >= threshold:
                entries = []
                for log in logs[i:j]:
                    time_str = log.created_at.strftime("%H:%M")
                    matches_str = ""
                    if log.filter_details and "matches" in log.filter_details:
                        matches_str = ", ".join(
                            m.get("rule_name", "?") for m in log.filter_details["matches"]
                        )
                    request_summary = _summarize_request(log.request_body)
                    entries.append(f"{time_str} \"{request_summary}\" → {matches_str}")

                incident = {
                    "start": logs[i].created_at.strftime("%m-%d %H:%M"),
                    "end": logs[j - 1].created_at.strftime("%H:%M"),
                    "count": j - i,
                    "entries": entries,
                }
                burst_results.setdefault(user_name, []).append(incident)
                i = j
            else:
                i += 1

    return burst_results
