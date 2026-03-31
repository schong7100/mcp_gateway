"""필터 규칙 시드 데이터.

앱 시작 시 DB에 시드 규칙이 없으면 자동 삽입합니다.
기존 규칙이 있으면 건너뜁니다 (name 기준 중복 체크).
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import FilterRule

SEED_RULES: list[dict] = [
    # === 카테고리 1: 인증/자격증명 ===
    {
        "name": "주민등록번호",
        "description": "대한민국 주민등록번호 패턴",
        "rule_type": "regex",
        "pattern": r"\d{6}-[1-4]\d{6}",
        "service": "all",
        "direction": "both",
    },
    {
        "name": "민감 키워드",
        "description": "범용 민감 키워드",
        "rule_type": "keyword",
        "pattern": (
            "password,secret,credential,private_key,"
            "비밀번호,passwd,token,api_key,access_key"
        ),
        "service": "all",
        "direction": "both",
    },
    {
        "name": "AWS 액세스 키",
        "description": "AWS IAM 액세스 키 패턴",
        "rule_type": "regex",
        "pattern": r"AKIA[0-9A-Z]{16}",
        "service": "all",
        "direction": "request",
    },
    {
        "name": "클라우드 시크릿",
        "description": "클라우드 시크릿 할당문 패턴",
        "rule_type": "regex",
        "pattern": r"(?i)(aws_secret|gcp_key|azure_secret|client_secret)\s*[=:]\s*\S+",
        "service": "all",
        "direction": "both",
    },
    {
        "name": "인증 토큰 키워드",
        "description": "인증 관련 키워드",
        "rule_type": "keyword",
        "pattern": "API_KEY,ACCESS_TOKEN,SECRET_TOKEN,Bearer,JWT_SECRET,PRIVATE_KEY,SSH_KEY",
        "service": "all",
        "direction": "both",
    },
    # === 카테고리 2: 네트워크/인프라 ===
    {
        "name": "IP 주소",
        "description": "응답에서 모든 IP 주소 마스킹",
        "rule_type": "regex",
        "pattern": r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}",
        "service": "all",
        "direction": "response",
    },
    {
        "name": "사설 IP 대역",
        "description": "RFC1918 사설IP 대역 — 요청만 차단",
        "rule_type": "regex",
        "pattern": r"(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}",
        "service": "all",
        "direction": "request",
    },
    {
        "name": "내부 도메인",
        "description": "*.internal, *.corp, *.local 내부 도메인",
        "rule_type": "regex",
        "pattern": r"\b[\w.-]+\.(?:internal|corp|local)\b",
        "service": "all",
        "direction": "both",
    },
    {
        "name": "DB 접속 정보",
        "description": "DB connection string 패턴",
        "rule_type": "regex",
        "pattern": r"(?i)(?:mysql|postgres|mongodb|redis)://\S+",
        "service": "all",
        "direction": "both",
    },
    # === 카테고리 3: PII ===
    {
        "name": "휴대폰번호",
        "description": "한국 휴대폰번호 패턴",
        "rule_type": "regex",
        "pattern": r"01[016789]-?\d{3,4}-?\d{4}",
        "service": "all",
        "direction": "both",
    },
    {
        "name": "이메일 주소",
        "description": "이메일 주소 — 요청만 차단",
        "rule_type": "regex",
        "pattern": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "service": "all",
        "direction": "request",
    },
    {
        "name": "신용카드번호",
        "description": "Visa/Master/Discover/Amex 카드번호",
        "rule_type": "regex",
        "pattern": r"\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})\d{8,12}\b",
        "service": "all",
        "direction": "both",
    },
    {
        "name": "계좌번호",
        "description": "한국 은행 계좌번호 패턴",
        "rule_type": "regex",
        "pattern": r"\b\d{3}-?\d{2,6}-?\d{2,6}-?\d{2,4}\b",
        "service": "all",
        "direction": "both",
    },
]


async def seed_filter_rules(db: AsyncSession) -> int:
    """시드 필터 규칙을 DB에 삽입합니다. 이미 존재하는 규칙(name 기준)은 건너뜁니다.

    Returns:
        추가된 규칙 수
    """
    result = await db.execute(select(func.count()).select_from(FilterRule))
    existing_count = result.scalar() or 0

    if existing_count > 0:
        # 기존 규칙이 있으면 name 기준으로 누락된 것만 추가
        result = await db.execute(select(FilterRule.name))
        existing_names = {row[0] for row in result.all()}
    else:
        existing_names = set()

    added = 0
    for rule_data in SEED_RULES:
        if rule_data["name"] in existing_names:
            continue
        rule = FilterRule(created_by="system", **rule_data)
        db.add(rule)
        added += 1

    if added > 0:
        await db.commit()

    return added
