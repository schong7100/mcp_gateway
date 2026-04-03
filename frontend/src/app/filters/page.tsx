'use client';

import { useEffect, useState } from 'react';
import { fetchFilters, createFilter, updateFilter, deleteFilter, FilterRule } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const DIRECTION_LABELS: Record<string, string> = {
  request: '요청',
  response: '응답',
  both: '양방향',
};

const TYPE_LABELS: Record<string, string> = {
  regex: '정규식',
  keyword: '키워드',
  quality: '품질',
};

export default function FiltersPage() {
  const { token, isAdmin, isLoading: authLoading } = useAuth();
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    rule_type: 'regex',
    pattern: '',
    service: 'all',
    direction: 'both',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRules(await fetchFilters(token));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading]);

  async function handleToggle(rule: FilterRule) {
    try {
      const updated = await updateFilter(token, rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '업데이트 실패');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 규칙을 삭제하시겠습니까?')) return;
    try {
      await deleteFilter(token, id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createFilter(token, newRule);
      setRules((prev) => [...prev, created]);
      setShowAddForm(false);
      setNewRule({ name: '', rule_type: 'regex', pattern: '', service: 'all', direction: 'both', description: '' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">필터 규칙 관리</h1>
        {isAdmin && (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? '취소' : '+ 새 규칙'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
          오류: {error}
        </div>
      )}

      {showAddForm && isAdmin && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">새 필터 규칙 추가</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
              <input
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">유형</label>
              <select
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={newRule.rule_type}
                onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
              >
                <option value="regex">정규식</option>
                <option value="keyword">키워드</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">패턴 *</label>
              <input
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 dark:text-gray-200"
                value={newRule.pattern}
                onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                placeholder={newRule.rule_type === 'regex' ? '\\d{6}-[1-4]\\d{6}' : 'password,secret'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">서비스</label>
              <select
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={newRule.service}
                onChange={(e) => setNewRule({ ...newRule, service: e.target.value })}
              >
                <option value="all">전체</option>
                <option value="context7">Context7</option>
                <option value="exa">Exa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">방향</label>
              <select
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={newRule.direction}
                onChange={(e) => setNewRule({ ...newRule, direction: e.target.value })}
              >
                <option value="both">양방향</option>
                <option value="request">요청만</option>
                <option value="response">응답만</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
              <input
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 text-sm border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
              onClick={() => setShowAddForm(false)}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">이름</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">유형</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">패턴</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">서비스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">방향</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">상태</th>
              {isAdmin && <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-300">작업</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={isAdmin ? 7 : 6}>
                  로딩 중...
                </td>
              </tr>
            ) : rules.length > 0 ? (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-3 font-medium dark:text-gray-200">
                    {rule.name}
                    {rule.description && (
                      <p className="text-xs text-gray-400 font-normal">{rule.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {rule.pattern}
                  </td>
                  <td className="px-6 py-3 capitalize dark:text-gray-300">{rule.service}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      rule.direction === 'both'
                        ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400'
                        : rule.direction === 'request'
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                        : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                    }`}>
                      {DIRECTION_LABELS[rule.direction] ?? rule.direction}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {isAdmin ? (
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                          rule.enabled
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/70'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {rule.enabled ? '활성' : '비활성'}
                      </button>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        rule.enabled
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {rule.enabled ? '활성' : '비활성'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={isAdmin ? 7 : 6}>
                  필터 규칙이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
