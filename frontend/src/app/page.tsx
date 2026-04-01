'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fetchDashboardStats, DashboardStats } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SERVICE_COLORS: Record<string, string> = {
  c7: '#3b82f6',
  exa: '#8b5cf6',
};

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    fetchDashboardStats(token)
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, authLoading]);

  const pieData = stats
    ? Object.entries(stats.service_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          오류: {error}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">오늘 검색 요청</h2>
          <p className="text-3xl font-bold mt-2">
            {loading ? '...' : stats?.total_today ?? 0}
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

      {/* 차트 영역 */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 서비스별 요청 분포 파이차트 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">서비스별 요청 분포 (오늘)</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name ?? ''} ${(((percent as number | undefined) ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={SERVICE_COLORS[entry.name] ?? '#6b7280'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}건`, '요청 수']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm text-center py-16">데이터 없음</p>
            )}
          </div>

          {/* 시간별 검색 트렌드 막대그래프 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">시간별 검색 트렌드 (최근 24시간)</h2>
            {stats.hourly_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.hourly_trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value}건`, '요청 수']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm text-center py-16">데이터 없음</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
