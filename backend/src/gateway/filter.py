import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import FilterRule


@dataclass
class FilterMatch:
    rule_id: str
    rule_name: str
    rule_type: str
    matched_text: str


@dataclass
class FilterResult:
    passed: bool
    matches: list[FilterMatch] = field(default_factory=list)


class ContentFilter:
    """양방향 콘텐츠 필터 엔진.

    DB에 저장된 필터 규칙을 기반으로 요청/응답 본문을 검사합니다.
    - regex: 정규식 패턴 매칭 (주민등록번호, IP 주소, 서버 정보 등)
    - keyword: 키워드 블랙리스트 매칭
    - quality: 품질 점수 임계값 (Context7 score 기반)

    방향(direction):
    - request: 요청 본문만 검사 → 매칭 시 403 차단
    - response: 응답 본문만 검사 → 매칭 시 [REDACTED] 마스킹
    - both: 양방향 검사
    """

    async def load_rules(
        self, db: AsyncSession, service: str, direction: str = "both"
    ) -> list[FilterRule]:
        stmt = select(FilterRule).where(
            FilterRule.enabled.is_(True),
            FilterRule.service.in_([service, "all"]),
            FilterRule.direction.in_([direction, "both"]),
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    def apply(self, rules: list[FilterRule], content: str) -> FilterResult:
        matches: list[FilterMatch] = []
        for rule in rules:
            if rule.rule_type == "regex":
                found = re.findall(rule.pattern, content)
                for match_text in found:
                    matches.append(
                        FilterMatch(
                            rule_id=str(rule.id),
                            rule_name=rule.name,
                            rule_type="regex",
                            matched_text=(
                                match_text if isinstance(match_text, str) else str(match_text)
                            ),
                        )
                    )
            elif rule.rule_type == "keyword":
                keywords = [kw.strip() for kw in rule.pattern.split(",")]
                for kw in keywords:
                    # 단어 경계 매칭 — totalTokens의 Token 같은 부분 매칭 방지
                    pattern = r"(?<![a-zA-Z0-9_])" + re.escape(kw) + r"(?![a-zA-Z0-9_])"
                    if re.search(pattern, content, re.IGNORECASE):
                        matches.append(
                            FilterMatch(
                                rule_id=str(rule.id),
                                rule_name=rule.name,
                                rule_type="keyword",
                                matched_text=kw,
                            )
                        )

        return FilterResult(passed=len(matches) == 0, matches=matches)

    def redact(self, rules: list[FilterRule], content: str) -> str:
        """매칭된 민감 정보를 마스킹 처리합니다."""
        redacted = content
        for rule in rules:
            if rule.rule_type == "regex":
                redacted = re.sub(rule.pattern, "[REDACTED]", redacted)
            elif rule.rule_type == "keyword":
                keywords = [kw.strip() for kw in rule.pattern.split(",")]
                for kw in keywords:
                    pattern = (
                        r"(?<![a-zA-Z0-9_])"
                        + re.escape(kw)
                        + r"(?![a-zA-Z0-9_])"
                    )
                    redacted = re.sub(
                        pattern, "[REDACTED]", redacted, flags=re.IGNORECASE
                    )
        return redacted


content_filter = ContentFilter()
