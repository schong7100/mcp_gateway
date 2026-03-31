'use client';

import { useEffect, useState } from 'react';
import { fetchUsers, createUser, KeycloakUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function UsersPage() {
  const { token, isAdmin, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<KeycloakUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      setError('관리자 권한이 필요합니다.');
      return;
    }
    fetchUsers(token)
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, authLoading, isAdmin]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser(token, newUser);
      const updated = await fetchUsers(token);
      setUsers(updated);
      setShowAddForm(false);
      setNewUser({ username: '', email: '', password: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin && !authLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">사용자 관리</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          관리자 권한이 필요합니다.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? '취소' : '+ 사용자 추가'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          오류: {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">새 사용자 추가</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사용자명 *</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                className="w-full border rounded px-3 py-2 text-sm"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초기 비밀번호</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 text-sm"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="미입력 시 changeme"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">* 역할 할당은 Keycloak 관리 콘솔에서 직접 설정하세요.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="px-4 py-2 text-sm border rounded hover:bg-gray-50" onClick={() => setShowAddForm(false)}>
              취소
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자명</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">이메일</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">생성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={4}>
                  로딩 중...
                </td>
              </tr>
            ) : users.length > 0 ? (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-3 font-medium">{u.username}</td>
                  <td className="px-6 py-3 text-gray-600">{u.email ?? '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      u.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.enabled ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">
                    {u.createdTimestamp
                      ? new Date(u.createdTimestamp).toLocaleString('ko-KR')
                      : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-6 py-8 text-center text-gray-400" colSpan={4}>
                  사용자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">역할 안내</h3>
        <ul className="mt-2 text-sm text-blue-700 space-y-1">
          <li>• <strong>admin</strong>: 필터 관리 + 사용자 관리 + 모든 로그 조회</li>
          <li>• <strong>viewer</strong>: 로그 조회만 (읽기 전용)</li>
          <li>• 역할 할당은 Keycloak 관리 콘솔 (http://localhost:8080) → Users → Role mapping에서 설정</li>
        </ul>
      </div>
    </div>
  );
}
