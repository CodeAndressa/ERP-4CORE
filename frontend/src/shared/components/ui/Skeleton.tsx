import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

function Bone({ className = '', style }: SkeletonProps) {
  return <div className={`animate-pulse rounded-full bg-violet-100 ${className}`} style={style} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-[22px] border border-violet-100 bg-white p-5">
      <Bone className="h-3 w-20" />
      <Bone className="h-7 w-32" />
      <Bone className="h-2.5 w-48" />
    </div>
  );
}

export function SkeletonMetricGrid({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-${cols}`}>
      {Array.from({ length: cols }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-violet-100 bg-white">
      <div className="border-b border-violet-100 px-5 py-3.5">
        <Bone className="h-3 w-24" />
      </div>
      <div className="divide-y divide-violet-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-8 w-8 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-3 w-48" />
              <Bone className="h-2.5 w-32" />
            </div>
            <Bone className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-[22px] border border-violet-100 bg-white p-5">
      <div className="mb-4 space-y-2">
        <Bone className="h-3 w-28" />
        <Bone className="h-2.5 w-40" />
      </div>
      <div className="flex h-48 items-end gap-2 pt-4">
        {[65, 45, 80, 55, 90, 40, 75, 60, 85, 50, 70, 95].map((h, i) => (
          <Bone key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
