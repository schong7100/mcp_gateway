'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardStats, DashboardStats } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats('')
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          오류: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">오늘 검색 요청</h2>
          <p className="text-3xl font-bold mt-2">
            {loading ? '...' : stats?.total_today ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">필터링 건수</h2>
          <p className="text-3xl font-bold mt-2 text-yellow-600">
            {loading ? '...' : stats?.filtered_today ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">차단 건수</h2>
          <p className="text-3xl font-bold mt-2 text-red-600">
            {loading ? '...' : stats?.blocked_today ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">활성 필터 규칙</h2>
          <p className="text-3xl font-bold mt-2">
            {loading ? '...' : stats?.active_rules ?? 0}
          </p>
        </div>
      </div>

      {stats && Object.keys(stats.service_breakdown).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">서비스별 요청 분포 (오늘)</h2>
          <div className="space-y-3">
            {Object.entries(stats.service_breakdown).map(([service, count]) => {
              const pct = stats.total_today > 0
                ? Math.round((count / stats.total_today) * 100)
                : 0;
              return (
                <div key={service}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{service}</span>
                    <span className="text-gray-500">{count}건 ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
