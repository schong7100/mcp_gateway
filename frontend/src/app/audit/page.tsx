'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchAuditTrail, AuditTrailEntry, AuditTrailList } from '@/lib/api';

const ACTION_LABELS: Record<string, string> = {
  search: '검색',
  search_blocked: '검색 차단',
  filter_create: '필터 생성',
  filter_update: '필터 수정',
  filter_delete: '필터 삭제',
};

export default function AuditPage() {
  const [data, setData] = useState<AuditTrailList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  function load(actionVal: string, userIdVal: string, pageVal: number) {
    setLoading(true);
    setError(null);
    fetchAuditTrail('', {
      page: pageVal,
      action: actionVal || undefined,
      user_id: userIdVal || undefined,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(action, userId, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(action, userIdRef.current, 1);
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">감사 로그</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          오류: {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <form onSubmit={handleSearch} className="px-6 py-4 border-b flex items-center gap-4">
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
          >
            <option value="">전체 액션</option>
            <option value="search">검색</option>
            <option value="search_blocked">검색 차단</option>
            <option value="filter_create">필터 생성</option>
            <option value="filter_update">필터 수정</option>
            <option value="filter_delete">필터 삭제</option>
          </select>
          <input
            type="text"
            placeholder="사용자 ID"
            className="border rounded px-3 py-1.5 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <button type="submit" className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">
            검색
          </button>
          {data && (
            <span className="ml-auto text-sm text-gray-500">전체 {data.total}건</span>
          )}
        </form>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">시간</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">액션</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">리소스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={5}>
                  로딩 중...
                </td>
              </tr>
            ) : data && data.items.length > 0 ? (
              data.items.map((entry: AuditTrailEntry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-3">{entry.user_name}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      entry.action === 'search_blocked'
                        ? 'bg-red-100 text-red-700'
                        : entry.action.startsWith('filter_')
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {entry.resource_type}
                    {entry.resource_id && (
                      <span className="text-gray-400 text-xs ml-1">#{entry.resource_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {entry.details ? JSON.stringify(entry.details) : '—'}
                  </td>
                </tr>
              ))
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
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <button
              className="text-sm px-3 py-1 border rounded disabled:opacity-40"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              이전
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              className="text-sm px-3 py-1 border rounded disabled:opacity-40"
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
