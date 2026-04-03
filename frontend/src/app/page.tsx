'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { fetchDashboardStats, fetchTopBlockedUsers, DashboardStats, BlockedUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SERVICE_COLORS: Record<string, string> = {
  c7: '#3b82f6',
  exa: '#8b5cf6',
};

const PERIOD_LABELS: Record<string, string> = {
  today: '오늘',
  week: '최근 1주일',
  month: '최근 1개월',
};

const BAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#3b82f6', '#3b82f6', '#6b7280', '#6b7280', '#6b7280', '#6b7280'];

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback((p: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchDashboardStats(token, p),
      fetchTopBlockedUsers(token, p),
    ])
      .then(([s, u]) => { setStats(s); setBlockedUsers(u); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    loadData(period);
  }, [authLoading, period, loadData]);

  const pieData = stats
    ? Object.entries(stats.service_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  function handleUserClick(userName: string) {
    router.push(`/audit?user_id=${encodeURIComponent(userName)}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">대시보드</h1>
        <select
          className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="today">오늘</option>
          <option value="week">최근 1주일</option>
          <option value="month">최근 1개월</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
          오류: {error}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            검색 요청 ({PERIOD_LABELS[period]})
          </h2>
          <p className="text-3xl font-bold mt-2 dark:text-white">
            {loading ? '...' : stats?.total ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            차단률 ({PERIOD_LABELS[period]})
          </h2>
          <p className="text-3xl font-bold mt-2 text-red-600 dark:text-red-400">
            {loading ? '...' : `${stats?.block_rate ?? 0}%`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {!loading && stats ? `${stats.blocked}건 / ${stats.total}건` : ''}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">활성 차단 규칙</h2>
          <p className="text-3xl font-bold mt-2 dark:text-white">
            {loading ? '...' : stats?.active_rules ?? 0}
          </p>
        </div>
      </div>

      {/* 차트 영역 */}
      {!loading && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* 서비스별 요청 분포 파이차트 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">
                서비스별 요청 분포 ({PERIOD_LABELS[period]})
              </h2>
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

            {/* 시간별 검색 요청량 막대그래프 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">
                시간별 검색 요청량 ({PERIOD_LABELS[period]})
              </h2>
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

          {/* 차단 상위 10명 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              차단 상위 사용자 ({PERIOD_LABELS[period]})
            </h2>
            {blockedUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={blockedUsers}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 80, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="user_name"
                    tick={(props) => {
                      const { x, y, payload, index } = props as { x: number; y: number; payload: { value: string }; index: number };
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fontSize={12}
                          fontWeight={index < 3 ? 700 : 400}
                          fill={index < 3 ? '#ef4444' : '#6b7280'}
                          className="cursor-pointer"
                          onClick={() => handleUserClick(payload.value)}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                    width={70}
                  />
                  <Tooltip formatter={(value) => [`${value}건`, '차단 수']} />
                  <Bar
                    dataKey="blocked_count"
                    radius={[0, 3, 3, 0]}
                    onClick={(_data, index) => { if (typeof index === 'number') handleUserClick(blockedUsers[index].user_name); }}
                    className="cursor-pointer"
                  >
                    {blockedUsers.map((_, index) => (
                      <Cell key={index} fill={BAR_COLORS[index] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm text-center py-16">차단 기록 없음</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
