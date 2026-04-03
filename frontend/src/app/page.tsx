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
import {
  StatCard,
  StatCardSkeleton,
  ChartCard,
  ChartCardSkeleton,
  HeroBanner,
} from '@/components/dashboard';

/* ── Constants ──────────────────────────────────────────────────────── */

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

/* ── Icons (inline SVG) ─────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

/* ── Custom Recharts Tooltip ────────────────────────────────────────── */

function CustomTooltip({ active, payload, label, unit = '건' }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg border"
      style={{
        background: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="text-[var(--color-muted)]">
          {entry.value.toLocaleString()}{unit}
        </p>
      ))}
    </div>
  );
}

/* ── Period Selector ────────────────────────────────────────────────── */

function PeriodSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg p-1"
      style={{ background: 'rgba(255,255,255,.1)' }}
    >
      {Object.entries(PERIOD_LABELS).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            value === key
              ? 'bg-white text-[#1B3F7A] shadow-sm'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Dashboard Page ─────────────────────────────────────────────────── */

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
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner
        title="보안 대시보드"
        subtitle="AI 검색 프록시 실시간 모니터링"
        periodSelector={<PeriodSelector value={period} onChange={setPeriod} />}
      />

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard
            label={`검색 요청 (${PERIOD_LABELS[period]})`}
            value={String(stats?.total ?? 0)}
            variant="primary"
            icon={<SearchIcon />}
          />
          <StatCard
            label={`차단률 (${PERIOD_LABELS[period]})`}
            value={`${stats?.block_rate ?? 0}%`}
            sub={stats ? `차단 ${stats.blocked}건 / 전체 ${stats.total}건` : undefined}
            variant="danger"
            icon={<BlockIcon />}
          />
          <StatCard
            label="활성 차단 규칙"
            value={String(stats?.active_rules ?? 0)}
            variant="accent"
            icon={<ShieldIcon />}
          />
        </div>
      )}

      {/* Divider */}
      <div className="section-divider" />

      {/* Charts Row */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Service Breakdown Pie */}
          <ChartCard
            title="서비스별 요청 분포"
            subtitle={PERIOD_LABELS[period]}
            empty={pieData.length === 0}
          >
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
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
                <Tooltip content={<CustomTooltip unit="건" />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-[var(--color-muted)]">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Hourly Trend Bar */}
          <ChartCard
            title="시간별 검색 요청량"
            subtitle={PERIOD_LABELS[period]}
            empty={stats.hourly_trend.length === 0}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.hourly_trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip unit="건" />} />
                <Bar dataKey="count" fill="#1B3F7A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Top Blocked Users */}
      {loading ? (
        <ChartCardSkeleton />
      ) : stats && (
        <ChartCard
          title="차단 상위 사용자 Top 10"
          subtitle={PERIOD_LABELS[period]}
          action={
            blockedUsers.length > 0 ? (
              <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                클릭하면 감사 로그로 이동
              </span>
            ) : undefined
          }
          empty={blockedUsers.length === 0}
          emptyMessage="차단 기록 없음"
        >
          <ResponsiveContainer width="100%" height={Math.max(280, blockedUsers.length * 36)}>
            <BarChart
              data={blockedUsers}
              layout="vertical"
              margin={{ top: 4, right: 32, left: 90, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                allowDecimals={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
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
                      className="cursor-pointer hover:underline"
                      onClick={() => handleUserClick(payload.value)}
                    >
                      {index < 3 ? `● ${payload.value}` : payload.value}
                    </text>
                  );
                }}
                width={84}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip unit="건" />} />
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
        </ChartCard>
      )}
    </div>
  );
}
