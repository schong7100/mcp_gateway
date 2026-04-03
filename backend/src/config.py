from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "MCP_GATEWAY_"}

    # Database
    database_url: str = "postgresql+asyncpg://mcp:mcp@localhost:5432/mcp_gateway"

    # Upstream APIs
    context7_base_url: str = "https://context7.com/api"
    exa_base_url: str = "https://api.exa.ai"
    exa_api_key: str = ""

    # Proxy API key (for MCP stdio servers that can't send JWT)
    proxy_api_key: str = ""

    # Keycloak
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "mcp-gateway"
    keycloak_client_id: str = "mcp-gateway-api"
    keycloak_admin_client_id: str = "mcp-gateway-admin"
    keycloak_admin_client_secret: str = ""
    keycloak_admin_username: str = "admin"
    keycloak_admin_password: str = "admin"

    # Proxy
    http_proxy: str = ""
    https_proxy: str = ""

    # Content filter
    filter_enabled: bool = True

    # Dev mode (bypass JWT auth for local testing)
    dev_mode: bool = False


settings = Settings()
