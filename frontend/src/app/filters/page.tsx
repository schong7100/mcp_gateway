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
};

const DIRECTION_STYLE: Record<string, { bg: string; color: string }> = {
  both:     { bg: '#F3E8FF', color: '#7C3AED' },
  request:  { bg: '#EBF0FF', color: '#1B3F7A' },
  response: { bg: '#DCFCE7', color: '#16A34A' },
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

  const inputClass = "w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder:text-[var(--color-muted)]";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">필터 규칙 관리</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">콘텐츠 보안 필터 규칙 설정</p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary"
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? '취소' : '+ 새 규칙'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Add form */}
      {showAddForm && isAdmin && (
        <form onSubmit={handleCreate} className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#E8821C' }} />
            <h2 className="text-base font-bold text-[var(--color-text)]">새 필터 규칙 추가</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">이름 *</label>
              <input className={inputClass} value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">유형</label>
              <select className={inputClass} value={newRule.rule_type}
                onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}>
                <option value="regex">정규식</option>
                <option value="keyword">키워드</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">패턴 *</label>
              <input
                className={`${inputClass} font-mono`}
                value={newRule.pattern}
                onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                placeholder={newRule.rule_type === 'regex' ? '\\d{6}-[1-4]\\d{6}' : 'password,secret'}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">서비스</label>
              <select className={inputClass} value={newRule.service}
                onChange={(e) => setNewRule({ ...newRule, service: e.target.value })}>
                <option value="all">전체</option>
                <option value="context7">Context7</option>
                <option value="exa">Exa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">방향</label>
              <select className={inputClass} value={newRule.direction}
                onChange={(e) => setNewRule({ ...newRule, direction: e.target.value })}>
                <option value="both">양방향</option>
                <option value="request">요청만</option>
                <option value="response">응답만</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">설명</label>
              <input className={inputClass} value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button"
              className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] transition-colors"
              onClick={() => setShowAddForm(false)}>
              취소
            </button>
            <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">이름</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">유형</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">패턴</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">서비스</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">방향</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">상태</th>
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">작업</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr>
                <td className="px-6 py-10 text-center text-[var(--color-muted)]" colSpan={isAdmin ? 7 : 6}>
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    로딩 중...
                  </span>
                </td>
              </tr>
            ) : rules.length > 0 ? (
              rules.map((rule) => {
                const dirStyle = DIRECTION_STYLE[rule.direction] ?? DIRECTION_STYLE.both;
                return (
                  <tr key={rule.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-semibold text-[var(--color-text)]">{rule.name}</p>
                      {rule.description && (
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">{rule.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: 'var(--color-surface)', color: 'var(--color-muted)' }}>
                        {TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-[var(--color-muted)] max-w-xs truncate">
                      {rule.pattern}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--color-text)]">{rule.service}</td>
                    <td className="px-6 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: dirStyle.bg, color: dirStyle.color }}>
                        {DIRECTION_LABELS[rule.direction] ?? rule.direction}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {isAdmin ? (
                        <button
                          onClick={() => handleToggle(rule)}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all"
                          style={{
                            background: rule.enabled ? '#DCFCE7' : 'var(--color-surface)',
                            color: rule.enabled ? '#16A34A' : 'var(--color-muted)',
                          }}
                        >
                          {rule.enabled ? '활성' : '비활성'}
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: rule.enabled ? '#DCFCE7' : 'var(--color-surface)',
                            color: rule.enabled ? '#16A34A' : 'var(--color-muted)',
                          }}>
                          {rule.enabled ? '활성' : '비활성'}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                          style={{ color: '#DC2626' }}
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#FEE2E2'; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                        >
                          삭제
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-6 py-10 text-center text-[var(--color-muted)]" colSpan={isAdmin ? 7 : 6}>
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
