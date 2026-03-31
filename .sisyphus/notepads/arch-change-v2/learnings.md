## [2026-03-31] Architecture Change v2 Context

### Project: MCP Gateway
- FastAPI backend + Next.js 15 frontend
- PostgreSQL + SQLAlchemy 2.0 async
- Bidirectional content filter engine

### Current Filter Logic (TO BE CHANGED)
- `filter.py`: `ContentFilter.apply()` → detects matches, `ContentFilter.redact()` → masks content
- `proxy.py`: request filter → 403 block; response filter → [REDACTED] masking
- `FilterRule.direction`: request | response | both

### Change 1: Filter → Pre-Masking (NO MORE 403)
- `proxy.py` `_handle_proxy()`: instead of returning 403 on request match, call `content_filter.redact()` on request body + query string
- Masked body/query forwarded to upstream
- Log as action="search" with filter_details showing direction="request" and matches
- `filtered=True` when any masking was applied (request or response)
- `dashboard.py`: blocked_today → masked_today (count where filtered=True)
- Frontend: "차단 건수" → "마스킹 건수", blocked_today → masked_today

### Change 2: IP-based Client Identification
- `deps.py`: When proxy API key matches, use request.client.host as user_id/username
  - user_id = f"ip:{client_ip}"
  - username = client_ip  (the IP address itself)
- No other changes needed in DB (user_name field stores IP)

### Change 3: Dashboard Charts
- Add recharts (npm install recharts) to frontend
- PieChart: service_breakdown (c7 vs exa)
- BarChart: hourly trend (last 24 hours)
- Backend: add hourly_trend to dashboard stats endpoint
  - Query: last 24h, group by hour, count requests

### Key File Locations
- Backend proxy: backend/src/api/proxy.py
- Filter engine: backend/src/gateway/filter.py
- Auth deps: backend/src/api/deps.py
- Dashboard API: backend/src/api/dashboard.py
- Frontend dashboard: frontend/src/app/page.tsx
- Frontend API client: frontend/src/lib/api.ts

### Critical: Masking the Request Body
- body is bytes → decode to str → redact() → encode back to bytes
- query_string is str → redact() → pass as masked_query
- forward_request() already accepts body (bytes) and query_string (str)
- Original body stored in DB log for audit (before masking)
