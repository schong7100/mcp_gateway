const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// Search Logs
export interface SearchLog {
  id: string;
  user_id: string;
  user_name: string;
  service: string;
  method: string;
  path: string;
  request_body: Record<string, unknown> | null;
  response_status: number;
  filtered: boolean;
  filter_details: Record<string, unknown> | null;
  created_at: string;
}

export interface SearchLogList {
  items: SearchLog[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchLogs(
  token: string,
  params?: { page?: number; service?: string; filtered_only?: boolean }
): Promise<SearchLogList> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.service) query.set("service", params.service);
  if (params?.filtered_only) query.set("filtered_only", "true");
  const qs = query.toString();
  return apiFetch(`/api/v1/logs${qs ? `?${qs}` : ""}`, { token });
}

// Filter Rules
export interface FilterRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  pattern: string;
  service: string;
  direction: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function fetchFilters(token: string): Promise<FilterRule[]> {
  return apiFetch("/api/v1/filters", { token });
}

export function createFilter(
  token: string,
  data: {
    name: string;
    rule_type: string;
    pattern: string;
    service?: string;
    direction?: string;
    description?: string;
  }
): Promise<FilterRule> {
  return apiFetch("/api/v1/filters", { method: "POST", body: data, token });
}

export function updateFilter(
  token: string,
  id: string,
  data: Partial<{
    name: string;
    pattern: string;
    service: string;
    direction: string;
    enabled: boolean;
  }>
): Promise<FilterRule> {
  return apiFetch(`/api/v1/filters/${id}`, { method: "PATCH", body: data, token });
}

export function deleteFilter(token: string, id: string): Promise<void> {
  return apiFetch(`/api/v1/filters/${id}`, { method: "DELETE", token });
}

// Audit Trail
export interface AuditTrailEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditTrailList {
  items: AuditTrailEntry[];
  total: number;
  page: number;
  page_size: number;
}

export function fetchAuditTrail(
  token: string,
  params?: { page?: number; user_id?: string; action?: string }
): Promise<AuditTrailList> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.user_id) query.set("user_id", params.user_id);
  if (params?.action) query.set("action", params.action);
  const qs = query.toString();
  return apiFetch(`/api/v1/audit${qs ? `?${qs}` : ""}`, { token });
}

// Users (Keycloak proxy)
export interface KeycloakUser {
  id: string;
  username: string;
  email: string | null;
  enabled: boolean;
  firstName: string | null;
  lastName: string | null;
  createdTimestamp: number | null;
}

export function fetchUsers(token: string): Promise<KeycloakUser[]> {
  return apiFetch("/api/v1/users", { token });
}

export function createUser(
  token: string,
  data: { username: string; email?: string; password?: string }
): Promise<{ id: string; username: string; created: boolean }> {
  return apiFetch("/api/v1/users", { method: "POST", body: data, token });
}

export function fetchUser(token: string, id: string): Promise<KeycloakUser> {
  return apiFetch(`/api/v1/users/${id}`, { token });
}

export function updateUser(
  token: string,
  id: string,
  data: Partial<{ enabled: boolean; email: string; firstName: string; lastName: string }>
): Promise<{ id: string; updated: boolean }> {
  return apiFetch(`/api/v1/users/${id}`, { method: "PATCH", body: data, token });
}

// Dashboard
export interface DashboardStats {
  total_today: number;
  filtered_today: number;
  blocked_today: number;
  active_rules: number;
  service_breakdown: Record<string, number>;
}

export function fetchDashboardStats(token: string): Promise<DashboardStats> {
  return apiFetch("/api/v1/dashboard/stats", { token });
}
