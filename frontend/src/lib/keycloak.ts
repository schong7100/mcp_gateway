// Keycloak configuration for Next.js
// Will be integrated with next-auth or keycloak-js when auth is fully implemented

export const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080",
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "mcp-gateway",
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "mcp-gateway-web",
};
