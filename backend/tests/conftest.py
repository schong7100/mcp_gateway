import pytest
from httpx import ASGITransport, AsyncClient

from src.api.deps import CurrentUser, get_current_user
from src.main import app


@pytest.fixture
def mock_user() -> CurrentUser:
    return CurrentUser(
        user_id="test-user-id",
        username="testuser",
        email="test@example.com",
        roles=["admin"],
    )


@pytest.fixture
async def client(mock_user: CurrentUser):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
