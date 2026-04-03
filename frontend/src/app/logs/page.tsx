'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchLogs, SearchLog, SearchLogList } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SEARCH_FIELDS = [
  { value: 'user_id', label: '사용자 (IP)' },
  { value: 'service', label: '서비스' },
  { value: 'query', label: '검색 내용' },
  { value: 'status_code', label: '상태' },
  { value: 'filter_reason', label: '차단 사유' },
];

interface FilterMatch {
  rule_name: string;
  rule_type: string;
  matched_text: string;
}

function extractQuery(log: SearchLog): string | null {
  const rb = log.request_body as Record<string, unknown> | null;
  if (!rb) return null;
  const qp = rb.query_params as Record<string, string> | undefined;
  if (qp?.query) return qp.query;
  const body = rb.body as Record<string, string> | undefined;
  if (body?.query) return body.query;
  if (typeof rb.query === 'string') return rb.query;
  return null;
}

function extractFilterMatches(log: SearchLog): FilterMatch[] {
  const fd = log.filter_details as Record<string, unknown> | null;
  if (!fd) return [];
  const matches = fd.matches as FilterMatch[] | undefined;
  return matches ?? [];
}

export default function LogsPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<SearchLogList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [searchField, setSearchField] = useState('user_id');
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtersRef = useRef({ startTime, endTime, searchField, searchValue });
  filtersRef.current = { startTime, endTime, searchField, searchValue };

  const load = useCallback((filters: typeof filtersRef.current, pageVal: number) => {
    setLoading(true);
    setError(null);
    const params: Record<string, string | number | boolean> = { page: pageVal };
    if (filters.startTime) params.start_time = filters.startTime;
    if (filters.endTime) params.end_time = filters.endTime;
    if (filters.searchValue) {
      params[filters.searchField] = filters.searchField === 'status_code'
        ? Number(filters.searchValue)
        : filters.searchValue;
    }
    fetchLogs(token, params as Parameters<typeof fetchLogs>[1])
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    load(filtersRef.current, page);
  }, [token, authLoading, page, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(filtersRef.current, 1);
  }

  function handleReset() {
    setStartTime('');
    setEndTime('');
    setSearchField('user_id');
    setSearchValue('');
    setPage(1);
    load({ startTime: '', endTime: '', searchField: 'user_id', searchValue: '' }, 1);
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">검색 로그</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">AI 프록시 검색 요청 기록</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {/* Search form */}
        <form onSubmit={handleSearch} className="px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">시작 시간</label>
              <input
                type="datetime-local"
                className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text)]"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">종료 시간</label>
              <input
                type="datetime-local"
                className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text)]"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">검색 기준</label>
              <select
                className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text)]"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              >
                {SEARCH_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">검색어</label>
              <input
                type="text"
                placeholder={`${SEARCH_FIELDS.find(f => f.value === searchField)?.label ?? ''} 검색...`}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary">검색</button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] transition-colors"
            >
              초기화
            </button>
            {data && (
              <span className="ml-auto text-sm text-[var(--color-muted)]">전체 {data.total}건</span>
            )}
          </div>
        </form>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">시간</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">사용자 (IP)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">서비스</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">검색 내용</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">상태</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">차단 사유</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr>
                <td className="px-6 py-10 text-center text-[var(--color-muted)]" colSpan={6}>
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    로딩 중...
                  </span>
                </td>
              </tr>
            ) : data && data.items.length > 0 ? (
              data.items.map((log: SearchLog) => {
                const query = extractQuery(log);
                const matches = extractFilterMatches(log);
                const isExpanded = expandedId === log.id;

                return (
                  <tr
                    key={log.id}
                    className={`cursor-pointer transition-colors ${
                      log.filtered
                        ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100/60 dark:hover:bg-red-900/20'
                        : 'hover:bg-[var(--color-surface)]'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <td className="px-6 py-3 text-xs text-[var(--color-muted)] whitespace-nowrap align-top">
                      {new Date(log.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-3 font-medium text-[var(--color-text)] align-top">{log.user_name}</td>
                    <td className="px-6 py-3 align-top">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold uppercase"
                        style={{
                          background: log.service === 'c7' ? '#EBF0FF' : '#FFF3E8',
                          color: log.service === 'c7' ? '#1B3F7A' : '#E8821C',
                        }}
                      >
                        {log.service}
                      </span>
                    </td>
                    <td className="px-6 py-3 align-top max-w-md">
                      {query ? (
                        <div>
                          <p className={`text-sm ${log.filtered ? 'text-red-700 dark:text-red-400 font-medium' : 'text-[var(--color-text)]'}`}>
                            {query}
                          </p>
                          {isExpanded && (
                            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
                              {log.method} /{log.path}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[var(--color-muted)]">
                          {log.method} /{log.path}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 align-top">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                        log.response_status >= 400
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                      }`}>
                        {log.response_status}
                      </span>
                    </td>
                    <td className="px-6 py-3 align-top">
                      {log.filtered && matches.length > 0 ? (
                        <div className="space-y-1">
                          {matches.map((m, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 whitespace-nowrap">
                                {m.rule_name}
                              </span>
                              {isExpanded && (
                                <span className="text-xs text-red-500 dark:text-red-400 font-mono break-all">
                                  &quot;{m.matched_text}&quot;
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : log.filtered ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400">
                          필터 차단
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-6 py-10 text-center text-[var(--color-muted)]" colSpan={6}>로그가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between">
            <button
              className="text-sm px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-muted)] disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              ← 이전
            </button>
            <span className="text-sm text-[var(--color-muted)]">{page} / {totalPages}</span>
            <button
              className="text-sm px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-muted)] disabled:opacity-40 hover:bg-[var(--color-surface)] transition-colors"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
