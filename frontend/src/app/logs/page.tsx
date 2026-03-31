'use client';

import { useEffect, useState } from 'react';
import { fetchLogs, SearchLog, SearchLogList } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface FilterMatch {
  rule_name: string;
  rule_type: string;
  matched_text: string;
}

function extractQuery(log: SearchLog): string | null {
  const rb = log.request_body as Record<string, unknown> | null;
  if (!rb) return null;

  // query_params.query (GET 요청)
  const qp = rb.query_params as Record<string, string> | undefined;
  if (qp?.query) return qp.query;

  // body.query (POST 요청)
  const body = rb.body as Record<string, string> | undefined;
  if (body?.query) return body.query;

  // legacy: 직접 body에 query
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
  const [service, setService] = useState('');
  const [filteredOnly, setFilteredOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    fetchLogs(token, { page, service: service || undefined, filtered_only: filteredOnly || undefined })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, authLoading, page, service, filteredOnly]);

  function handleServiceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setService(e.target.value);
    setPage(1);
  }

  function handleFilteredOnlyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFilteredOnly(e.target.checked);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">검색 로그</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          오류: {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center gap-4">
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={service}
            onChange={handleServiceChange}
          >
            <option value="">전체 서비스</option>
            <option value="context7">Context7</option>
            <option value="exa">Exa</option>
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={filteredOnly}
              onChange={handleFilteredOnlyChange}
            />
            필터링된 항목만
          </label>
          {data && (
            <span className="ml-auto text-sm text-gray-500">
              전체 {data.total}건
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">시간</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">서비스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">검색 내용</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">필터</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={6}>
                  로딩 중...
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
                    className={`${log.filtered ? 'bg-red-50' : ''} cursor-pointer hover:bg-gray-50`}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <td className="px-6 py-3 text-gray-600 whitespace-nowrap align-top">
                      {new Date(log.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-3 align-top">{log.user_name}</td>
                    <td className="px-6 py-3 capitalize align-top">{log.service}</td>
                    <td className="px-6 py-3 align-top max-w-md">
                      {query ? (
                        <div>
                          <p className={`text-sm ${log.filtered ? 'text-red-700' : 'text-gray-800'}`}>
                            {query}
                          </p>
                          {isExpanded && (
                            <p className="mt-1 font-mono text-xs text-gray-400">
                              {log.method} /{log.path}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-gray-500">
                          {log.method} /{log.path}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 align-top">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.response_status >= 400
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {log.response_status}
                      </span>
                    </td>
                    <td className="px-6 py-3 align-top">
                      {log.filtered && matches.length > 0 ? (
                        <div className="space-y-1">
                          {matches.map((m, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
                                {m.rule_name}
                              </span>
                              {isExpanded && (
                                <span className="text-xs text-red-500 font-mono break-all">
                                  &quot;{m.matched_text}&quot;
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : log.filtered ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          차단됨
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={6}>
                  로그가 없습니다.
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
