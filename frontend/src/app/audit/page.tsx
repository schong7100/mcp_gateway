'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchAuditTrail, AuditTrailEntry, AuditTrailList } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function getActionLabel(entry: AuditTrailEntry): { label: string; color: string } {
  switch (entry.action) {
    case 'search':
      return { label: '검색', color: 'bg-gray-100 text-gray-700' };
    case 'search_blocked':
      return { label: '차단', color: 'bg-red-100 text-red-700' };
    case 'filter_create':
      return { label: '규칙 생성', color: 'bg-blue-100 text-blue-700' };
    case 'filter_update':
      return { label: '규칙 수정', color: 'bg-blue-100 text-blue-700' };
    case 'filter_delete':
      return { label: '규칙 삭제', color: 'bg-red-100 text-red-700' };
    default:
      return { label: entry.action, color: 'bg-gray-100 text-gray-700' };
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
        <span className="text-red-700 font-medium">차단 {count ?? texts.length}건</span>
        <div className="space-y-0.5">
          {texts.map((mt, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="inline-flex px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium whitespace-nowrap">
                {mt.rule}
              </span>
              <span className="font-mono text-red-600 break-all">&quot;{mt.text}&quot;</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <span className="text-xs text-gray-500 truncate max-w-xs block">
      {JSON.stringify(details)}
    </span>
  );
}

export default function AuditPage() {
  const { token, isLoading: authLoading } = useAuth();
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
    fetchAuditTrail(token, {
      page: pageVal,
      action: actionVal || undefined,
      user_id: userIdVal || undefined,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (authLoading) return;
    load(action, userId, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading, action, page]);

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
            <option value="search_blocked">차단</option>
            <option value="filter_create">규칙 생성</option>
            <option value="filter_update">규칙 수정</option>
            <option value="filter_delete">규칙 삭제</option>
          </select>
          <input
            type="text"
            placeholder="사용자 IP"
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
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자 (IP)</th>
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
              data.items.map((entry: AuditTrailEntry) => {
                const { label, color } = getActionLabel(entry);
                return (
                  <tr key={entry.id}>
                    <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{entry.user_name}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
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
