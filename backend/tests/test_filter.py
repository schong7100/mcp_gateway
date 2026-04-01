import uuid
from dataclasses import dataclass

import pytest

from src.gateway.filter import ContentFilter


@pytest.fixture
def filter_engine() -> ContentFilter:
    return ContentFilter()


@dataclass
class FakeFilterRule:
    id: uuid.UUID
    name: str
    rule_type: str
    pattern: str
    service: str = "all"
    direction: str = "both"
    enabled: bool = True


def _make_rule(
    rule_type: str, pattern: str, name: str = "test", direction: str = "both"
) -> FakeFilterRule:
    return FakeFilterRule(
        id=uuid.uuid4(),
        name=name,
        rule_type=rule_type,
        pattern=pattern,
        direction=direction,
    )


class TestRegexFilter:
    def test_matches_korean_ssn(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("regex", r"\d{6}-[1-4]\d{6}", "주민등록번호")
        content = "주민번호는 900101-1234567 입니다."
        result = filter_engine.apply([rule], content)
        assert not result.passed
        assert len(result.matches) == 1
        assert result.matches[0].matched_text == "900101-1234567"

    def test_matches_ip_address(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("regex", r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", "IP주소")
        content = "서버 주소: 192.168.1.100"
        result = filter_engine.apply([rule], content)
        assert not result.passed
        assert result.matches[0].matched_text == "192.168.1.100"

    def test_no_match_passes(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("regex", r"\d{6}-[1-4]\d{6}", "주민등록번호")
        content = "일반적인 기술 문서입니다."
        result = filter_engine.apply([rule], content)
        assert result.passed
        assert len(result.matches) == 0


class TestKeywordFilter:
    def test_matches_keyword(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("keyword", "password,secret,credential", "민감키워드")
        content = "The database password is stored in vault."
        result = filter_engine.apply([rule], content)
        assert not result.passed
        assert result.matches[0].matched_text == "password"

    def test_case_insensitive(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("keyword", "SECRET", "대소문자")
        content = "this is a secret value"
        result = filter_engine.apply([rule], content)
        assert not result.passed

    def test_no_match_passes(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("keyword", "password,secret", "민감키워드")
        content = "FastAPI is a modern web framework."
        result = filter_engine.apply([rule], content)
        assert result.passed


class TestDirection:
    def test_request_direction_rule(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("keyword", "password", "요청필터", direction="request")
        result = filter_engine.apply([rule], "my password is 123")
        assert not result.passed

    def test_both_direction_rule(self, filter_engine: ContentFilter) -> None:
        rule = _make_rule("keyword", "secret", "양방향", direction="both")
        result = filter_engine.apply([rule], "this is a secret")
        assert not result.passed
