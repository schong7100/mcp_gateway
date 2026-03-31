"""API 통합 테스트 (실 PostgreSQL 사용).

AGENTS.md: "Integration: test against real PostgreSQL (no mocks for DB)"
테스트 DB: mcp_gateway_test (localhost:5432)
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.api.deps import CurrentUser, get_current_user
from src.db.base import Base
from src.db.models import SearchLog
from src.db.session import get_db
from src.main import app

TEST_DB_URL = "postgresql+asyncpg://mcp:mcp@localhost:5432/mcp_gateway_test"

test_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


def _admin_user() -> CurrentUser:
    return CurrentUser(
        user_id="test-admin", username="admin-test",
        email="admin@test.com", roles=["admin"],
    )


@pytest.fixture(autouse=True)
async def setup_and_clean():
    """각 테스트 전 테이블 생성 + 데이터 삭제, 후 정리."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            await db.execute(text(f"DELETE FROM {table.name}"))
        await db.commit()
    yield


@pytest.fixture
async def client():
    app.dependency_overrides[get_current_user] = _admin_user
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


class TestFiltersCRUD:
    @pytest.mark.asyncio
    async def test_create_and_list(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/filters",
            json={
                "name": "테스트", "rule_type": "keyword",
                "pattern": "test_secret", "service": "all",
                "direction": "both",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["enabled"] is True

        resp = await client.get("/api/v1/filters")
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_update_filter(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/filters",
            json={"name": "원본", "rule_type": "keyword", "pattern": "old"},
        )
        rule_id = resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/filters/{rule_id}",
            json={"pattern": "new", "enabled": False},
        )
        assert resp.status_code == 200
        assert resp.json()["pattern"] == "new"
        assert resp.json()["enabled"] is False

    @pytest.mark.asyncio
    async def test_delete_filter(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/filters",
            json={"name": "삭제", "rule_type": "keyword", "pattern": "x"},
        )
        rule_id = resp.json()["id"]

        assert (await client.delete(f"/api/v1/filters/{rule_id}")).status_code == 204
        assert len((await client.get("/api/v1/filters")).json()) == 0

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client: AsyncClient) -> None:
        resp = await client.get(f"/api/v1/filters/{uuid.uuid4()}")
        assert resp.status_code == 404


class TestLogs:
    @pytest.mark.asyncio
    async def test_empty_logs(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/logs")
        assert resp.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_logs_with_data(self, client: AsyncClient) -> None:
        async with TestSessionLocal() as db:
            db.add(SearchLog(
                user_id="u1", user_name="tester", service="c7",
                method="GET", path="v2/libs/search",
                request_body={"query_params": {"query": "fastapi"}},
                response_status=200, filtered=False,
            ))
            await db.commit()

        resp = await client.get("/api/v1/logs")
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["service"] == "c7"

    @pytest.mark.asyncio
    async def test_filtered_only(self, client: AsyncClient) -> None:
        async with TestSessionLocal() as db:
            db.add(SearchLog(
                user_id="u1", user_name="a", service="c7",
                method="GET", path="s", response_status=200, filtered=False,
            ))
            db.add(SearchLog(
                user_id="u1", user_name="a", service="c7",
                method="GET", path="s", response_status=403, filtered=True,
                filter_details={"matches": [{"rule_name": "주민등록번호"}]},
            ))
            await db.commit()

        resp = await client.get("/api/v1/logs?filtered_only=true")
        assert resp.json()["total"] == 1


class TestAudit:
    @pytest.mark.asyncio
    async def test_audit_on_filter_create(self, client: AsyncClient) -> None:
        await client.post(
            "/api/v1/filters",
            json={"name": "감사", "rule_type": "keyword", "pattern": "x"},
        )
        resp = await client.get("/api/v1/audit")
        assert "filter_create" in [i["action"] for i in resp.json()["items"]]


class TestDashboard:
    @pytest.mark.asyncio
    async def test_stats_empty(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/dashboard/stats")
        assert resp.status_code == 200
        assert resp.json()["total_today"] == 0


class TestAuth:
    @pytest.mark.asyncio
    async def test_unauthenticated_401(self) -> None:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides[get_db] = override_get_db
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/v1/filters")
            assert resp.status_code == 401
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_health_no_auth(self) -> None:
        app.dependency_overrides.clear()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/health")
            assert resp.status_code == 200


class TestSeed:
    @pytest.mark.asyncio
    async def test_seed_inserts_13_rules(self) -> None:
        from src.db.seed import seed_filter_rules

        async with TestSessionLocal() as db:
            assert await seed_filter_rules(db) == 13
            assert await seed_filter_rules(db) == 0  # 중복 없음
