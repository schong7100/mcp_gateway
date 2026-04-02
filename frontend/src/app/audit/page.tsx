'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchAuditTrail, AuditTrailEntry, AuditTrailList } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function getActionLabel(entry: AuditTrailEntry): { label: string; color: string } {
  switch (entry.action) {
    case 'search':
      return { label: '검색', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    case 'search_blocked':
      return { label: '차단', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' };
    case 'filter_create':
      return { label: '규칙 생성', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' };
    case 'filter_update':
      return { label: '규칙 수정', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' };
    case 'filter_delete':
      return { label: '규칙 삭제', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' };
    default:
      return { label: entry.action, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
  }
}

function DetailCell({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <span className="text-gray-400">—</span>;

  const blockedTexts = details.blocked_texts as { rule: string; text: string }[] | undefined;
  const filterTexts = details.filter_texts as { rule: string; text: string }[] | undefined;
  const texts = blockedTexts ?? filterTexts;
  const count = details.match_count as number | undefined;

  if (texts && texts.length > 0) {
    return (
      <div className="text-xs space-y-1">
        <span className="text-red-700 dark:text-red-400 font-medium">차단 {count ?? texts.length}건</span>
        <div className="space-y-0.5">
          {texts.map((mt, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="inline-flex px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 font-medium whitespace-nowrap">
                {mt.rule}
              </span>
              <span className="font-mono text-red-600 dark:text-red-400 break-all">&quot;{mt.text}&quot;</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs block">
      {JSON.stringify(details)}
    </span>
  );
}

export default function AuditPage() {
  const { token, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AuditTrailList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState(searchParams.get('user_id') ?? '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [detail, setDetail] = useState('');
  const [page, setPage] = useState(1);
  const filtersRef = useRef({ action, userId, startTime, endTime, resourceType, detail });
  filtersRef.current = { action, userId, startTime, endTime, resourceType, detail };

  const load = useCallback((filters: typeof filtersRef.current, pageVal: number) => {
    setLoading(true);
    setError(null);
    fetchAuditTrail(token, {
      page: pageVal,
      action: filters.action || undefined,
      user_id: filters.userId || undefined,
      start_time: filters.startTime || undefined,
      end_time: filters.endTime || undefined,
      resource_type: filters.resourceType || undefined,
      detail: filters.detail || undefined,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    load(filtersRef.current, page);
  }, [token, authLoading, page, load]);

  // URL 파라미터로 user_id가 전달된 경우 자동 검색
  useEffect(() => {
    const urlUserId = searchParams.get('user_id');
    if (urlUserId && urlUserId !== userId) {
      setUserId(urlUserId);
      setPage(1);
      load({ ...filtersRef.current, userId: urlUserId }, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(filtersRef.current, 1);
  }

  function handleReset() {
    setAction('');
    setUserId('');
    setStartTime('');
    setEndTime('');
    setResourceType('');
    setDetail('');
    setPage(1);
    load({ action: '', userId: '', startTime: '', endTime: '', resourceType: '', detail: '' }, 1);
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">감사 로그</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
          오류: {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <form onSubmit={handleSearch} className="px-6 py-4 border-b dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">시작 시간</label>
              <input
                type="datetime-local"
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">종료 시간</label>
              <input
                type="datetime-local"
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">사용자 (IP)</label>
              <input
                type="text"
                placeholder="IP 검색"
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">액션</label>
              <select
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="">전체</option>
                <option value="search">검색</option>
                <option value="search_blocked">차단</option>
                <option value="filter_create">규칙 생성</option>
                <option value="filter_update">규칙 수정</option>
                <option value="filter_delete">규칙 삭제</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">리소스</label>
              <input
                type="text"
                placeholder="리소스 타입"
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">상세</label>
              <input
                type="text"
                placeholder="상세 내용 검색"
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              검색
            </button>
            <button type="button" onClick={handleReset} className="px-4 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
              초기화
            </button>
            {data && (
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">전체 {data.total}건</span>
            )}
          </div>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">시간</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">사용자 (IP)</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">액션</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">리소스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={5}>
                  로딩 중...
                </td>
              </tr>
            ) : data && data.items.length > 0 ? (
              data.items.map((entry: AuditTrailEntry) => {
                const { label, color } = getActionLabel(entry);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs dark:text-gray-300">{entry.user_name}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">
                      {entry.resource_type}
                      {entry.resource_id && (
                        <span className="text-gray-400 text-xs ml-1">#{entry.resource_id.slice(0, 8)}</span>
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
                <td className="px-6 py-8 text-center text-gray-400" colSpan={5}>
                  감사 로그가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between">
            <button
              className="text-sm px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-40 dark:text-gray-300"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              이전
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
            <button
              className="text-sm px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-40 dark:text-gray-300"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
