import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

function Bone({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/6 ${className}`}
      style={style}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0d0a2a] p-5 space-y-3">
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
    <div className="rounded-2xl border border-white/8 bg-[#0d0a2a] overflow-hidden">
      <div className="border-b border-white/8 px-5 py-3.5">
        <Bone className="h-3 w-24" />
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-8 w-8 rounded-full flex-shrink-0" />
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
    <div className="rounded-2xl border border-white/8 bg-[#0d0a2a] p-5">
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
