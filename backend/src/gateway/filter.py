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
    """콘텐츠 필터 엔진 (최후 방어선).

    DB에 저장된 필터 규칙을 기반으로 요청 본문을 검사합니다.
    - regex: 정규식 패턴 매칭 (주민등록번호, IP 주소, 서버 정보 등)
    - keyword: 키워드 블랙리스트 매칭

    매칭 시 검색 요청을 차단합니다 (403).
    마스킹([REDACTED])은 122B 보안 페르소나가 담당합니다.
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


content_filter = ContentFilter()
