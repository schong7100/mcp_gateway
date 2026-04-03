'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchAuditTrail, AuditTrailEntry, AuditTrailList } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SEARCH_FIELDS = [
  { value: 'user_id', label: '사용자 (IP)' },
  { value: 'action', label: '액션' },
  { value: 'resource_type', label: '리소스' },
  { value: 'detail', label: '상세' },
];

function getActionBadge(entry: AuditTrailEntry): { label: string; bg: string; color: string } {
  switch (entry.action) {
    case 'search':
      return { label: '검색', bg: '#EBF0FF', color: '#1B3F7A' };
    case 'search_blocked':
      return { label: '차단', bg: '#FEE2E2', color: '#DC2626' };
    case 'filter_create':
      return { label: '규칙 생성', bg: '#DCFCE7', color: '#16A34A' };
    case 'filter_update':
      return { label: '규칙 수정', bg: '#FFF3E8', color: '#E8821C' };
    case 'filter_delete':
      return { label: '규칙 삭제', bg: '#FEE2E2', color: '#DC2626' };
    default:
      return { label: entry.action, bg: 'var(--color-surface)', color: 'var(--color-muted)' };
  }
}

function DetailCell({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <span className="text-[var(--color-muted)]">—</span>;

  const blockedTexts = details.blocked_texts as { rule: string; text: string }[] | undefined;
  const filterTexts = details.filter_texts as { rule: string; text: string }[] | undefined;
  const texts = blockedTexts ?? filterTexts;
  const count = details.match_count as number | undefined;

  if (texts && texts.length > 0) {
    return (
      <div className="text-xs space-y-1">
        <span className="font-medium" style={{ color: '#DC2626' }}>차단 {count ?? texts.length}건</span>
        <div className="space-y-0.5">
          {texts.map((mt, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                style={{ background: '#FEE2E2', color: '#DC2626' }}>
                {mt.rule}
              </span>
              <span className="font-mono text-xs break-all" style={{ color: '#DC2626' }}>&quot;{mt.text}&quot;</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <span className="text-xs text-[var(--color-muted)] truncate max-w-xs block">
      {JSON.stringify(details)}
    </span>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16 text-[var(--color-muted)]">
        <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        로딩 중...
      </div>
    }>
      <AuditContent />
    </Suspense>
  );
}

function AuditContent() {
  const { token, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AuditTrailList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [searchField, setSearchField] = useState('user_id');
  const [searchValue, setSearchValue] = useState(searchParams.get('user_id') ?? '');
  const [page, setPage] = useState(1);
  const filtersRef = useRef({ startTime, endTime, searchField, searchValue });
  filtersRef.current = { startTime, endTime, searchField, searchValue };

  const load = useCallback((filters: typeof filtersRef.current, pageVal: number) => {
    setLoading(true);
    setError(null);
    const params: Record<string, string | number | undefined> = { page: pageVal };
    if (filters.startTime) params.start_time = filters.startTime;
    if (filters.endTime) params.end_time = filters.endTime;
    if (filters.searchValue) {
      params[filters.searchField] = filters.searchValue;
    }
    fetchAuditTrail(token, params as Parameters<typeof fetchAuditTrail>[1])
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    load(filtersRef.current, page);
  }, [token, authLoading, page, load]);

  useEffect(() => {
    const urlUserId = searchParams.get('user_id');
    if (urlUserId && urlUserId !== searchValue) {
      setSearchField('user_id');
      setSearchValue(urlUserId);
      setPage(1);
      load({ ...filtersRef.current, searchField: 'user_id', searchValue: urlUserId }, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        <h1 className="text-2xl font-bold text-[var(--color-text)]">감사 로그</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">사용자 활동 및 보안 이벤트 기록</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      <div className="card overflow-hidden">
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

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">시간</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">사용자 (IP)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">액션</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">리소스</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr>
                <td className="px-6 py-10 text-center text-[var(--color-muted)]" colSpan={5}>
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
              data.items.map((entry: AuditTrailEntry) => {
                const badge = getActionBadge(entry);
                return (
                  <tr key={entry.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-6 py-3 text-xs text-[var(--color-muted)] whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs font-medium text-[var(--color-text)]">
                      {entry.user_name}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--color-text)]">
                      {entry.resource_type}
                      {entry.resource_id && (
                        <span className="text-[var(--color-muted)] text-xs ml-1">
                          #{entry.resource_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 max-w-xs">
                      <DetailCell details={entry.details} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-6 py-10 text-center text-[var(--color-muted)]" colSpan={5}>
                  감사 로그가 없습니다.
                </td>
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
