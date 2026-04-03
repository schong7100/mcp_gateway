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
  c7: '#1B3F7A',
  exa: '#E8821C',
};

const PERIOD_LABELS: Record<string, string> = {
  today: '오늘',
  week: '최근 1주일',
  month: '최근 1개월',
};

const BAR_COLORS = [
  '#DC2626', '#EA580C', '#D97706',
  '#1B3F7A', '#1B3F7A', '#1B3F7A',
  '#94A3B8', '#94A3B8', '#94A3B8', '#94A3B8',
];

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="card flex items-start gap-4 p-6"
      style={{ borderLeft: `4px solid ${accent ? '#E8821C' : '#1B3F7A'}` }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accent ? '#FFF3E8' : '#EBF0FF' }}
      >
        <span style={{ color: accent ? '#E8821C' : '#1B3F7A' }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">{label}</p>
        <p
          className="stat-value mt-1"
          style={{ color: accent ? '#DC2626' : undefined }}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-[var(--color-muted)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#E8821C' }} />
      <h2 className="text-base font-bold text-[var(--color-text)]">{children}</h2>
    </div>
  );
}

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
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">보안 대시보드</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">AI 검색 프록시 실시간 모니터링</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">조회 기간</span>
          <select
            className="border rounded-lg px-3 py-2 text-sm font-medium bg-[var(--color-card)] text-[var(--color-text)] border-[var(--color-border)] shadow-sm focus:outline-none focus:ring-2"
            style={{ focusRingColor: '#1B3F7A' } as React.CSSProperties}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">오늘</option>
            <option value="week">최근 1주일</option>
            <option value="month">최근 1개월</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          label={`검색 요청 (${PERIOD_LABELS[period]})`}
          value={loading ? '—' : String(stats?.total ?? 0)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
        <StatCard
          label={`차단률 (${PERIOD_LABELS[period]})`}
          value={loading ? '—' : `${stats?.block_rate ?? 0}%`}
          sub={!loading && stats ? `차단 ${stats.blocked}건 / 전체 ${stats.total}건` : undefined}
          accent
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <StatCard
          label="활성 차단 규칙"
          value={loading ? '—' : String(stats?.active_rules ?? 0)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
      </div>

      {/* 차트 영역 */}
      {!loading && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 서비스별 분포 */}
            <div className="card p-6">
              <SectionTitle>서비스별 요청 분포 ({PERIOD_LABELS[period]})</SectionTitle>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name ?? ''} ${(((percent as number | undefined) ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={SERVICE_COLORS[entry.name] ?? '#94A3B8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}건`, '요청 수']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-[var(--color-muted)] text-sm">데이터 없음</div>
              )}
            </div>

            {/* 시간별 요청량 */}
            <div className="card p-6">
              <SectionTitle>시간별 검색 요청량 ({PERIOD_LABELS[period]})</SectionTitle>
              {stats.hourly_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.hourly_trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [`${value}건`, '요청 수']}
                    />
                    <Bar dataKey="count" fill="#1B3F7A" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-[var(--color-muted)] text-sm">데이터 없음</div>
              )}
            </div>
          </div>

          {/* 차단 상위 사용자 */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>차단 상위 사용자 Top 10 ({PERIOD_LABELS[period]})</SectionTitle>
              {blockedUsers.length > 0 && (
                <span className="text-xs text-[var(--color-muted)]">
                  클릭하면 감사 로그로 이동합니다
                </span>
              )}
            </div>
            {blockedUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(280, blockedUsers.length * 34)}>
                <BarChart
                  data={blockedUsers}
                  layout="vertical"
                  margin={{ top: 4, right: 32, left: 90, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="user_name"
                    tick={(props) => {
                      const { x, y, payload, index } = props as {
                        x: number; y: number; payload: { value: string }; index: number;
                      };
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fontSize={12}
                          fontWeight={index < 3 ? 700 : 400}
                          fill={index < 3 ? '#DC2626' : 'var(--color-muted)'}
                          className="cursor-pointer"
                          onClick={() => handleUserClick(payload.value)}
                        >
                          {index < 3 ? `🔴 ${payload.value}` : payload.value}
                        </text>
                      );
                    }}
                    width={84}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${value}건`, '차단 수']}
                  />
                  <Bar
                    dataKey="blocked_count"
                    radius={[0, 4, 4, 0]}
                    onClick={(_data, index) => {
                      if (typeof index === 'number') handleUserClick(blockedUsers[index].user_name);
                    }}
                    className="cursor-pointer"
                  >
                    {blockedUsers.map((_, index) => (
                      <Cell key={index} fill={BAR_COLORS[index] ?? '#94A3B8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-32 text-[var(--color-muted)] text-sm">
                차단 기록 없음
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24 text-[var(--color-muted)]">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          데이터 로딩 중...
        </div>
      )}
    </div>
  );
}
