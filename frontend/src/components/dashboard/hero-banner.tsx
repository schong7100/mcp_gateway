interface HeroBannerProps {
  title: string;
  subtitle: string;
  periodSelector: React.ReactNode;
}

export function HeroBanner({ title, subtitle, periodSelector }: HeroBannerProps) {
  return (
    <div className="dashboard-hero text-white">
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-white/60 mt-1">{subtitle}</p>
        </div>
        {periodSelector}
      </div>
    </div>
  );
}
