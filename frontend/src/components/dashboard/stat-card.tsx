'use client';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: 'primary' | 'accent' | 'danger';
  icon: React.ReactNode;
}

const VARIANT_STYLES = {
  primary: {
    iconBg: '#EBF0FF',
    iconColor: '#1B3F7A',
    borderColor: '#1B3F7A',
  },
  accent: {
    iconBg: '#FFF3E8',
    iconColor: '#E8821C',
    borderColor: '#E8821C',
  },
  danger: {
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    borderColor: '#DC2626',
  },
};

export function StatCard({ label, value, sub, variant = 'primary', icon }: StatCardProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <div className="stat-card flex items-start gap-4" style={{ borderLeft: `4px solid ${style.borderColor}` }}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: style.iconBg }}
      >
        <span style={{ color: style.iconColor }}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">{label}</p>
        <p
          className="stat-value mt-1"
          style={{ color: variant === 'danger' ? '#DC2626' : undefined }}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-[var(--color-muted)] mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card flex items-start gap-4">
      <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-3 w-32" />
      </div>
    </div>
  );
}
