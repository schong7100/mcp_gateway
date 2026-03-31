from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.audit import router as audit_router
from src.api.dashboard import router as dashboard_router
from src.api.filters import router as filters_router
from src.api.logs import router as logs_router
from src.api.proxy import router as proxy_router
from src.api.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    from src.gateway.proxy import http_client

    await http_client.aclose()


app = FastAPI(
    title="MCP Gateway",
    description="HTTP Reverse Proxy for Context7 and Exa with bidirectional content filtering",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proxy_router)
app.include_router(logs_router)
app.include_router(filters_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(dashboard_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
