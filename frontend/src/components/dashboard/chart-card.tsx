interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, action, empty, emptyMessage = '데이터 없음', children }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 rounded-full bg-[var(--color-accent)]" />
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--color-muted)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {empty ? (
        <div className="flex items-center justify-center h-48 text-[var(--color-muted)] text-sm">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <div className="chart-card">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="skeleton w-1 h-5 rounded-full" />
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="skeleton h-60 w-full" />
    </div>
  );
}
