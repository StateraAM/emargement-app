'use client';

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function SkeletonLine({
  className,
  width,
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div
      className={cn(
        'h-4 rounded-md bg-[var(--color-border)] animate-pulse',
        className
      )}
      style={width ? { width } : undefined}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <SkeletonLine width="60%" className="h-5" />
          <SkeletonLine width="40%" className="h-3" />
        </div>
        <div className="h-9 w-9 rounded-xl bg-[var(--color-border)] animate-pulse ml-3" />
      </div>
      <SkeletonLine width="80%" className="h-3" />
    </div>
  );
}

export function SkeletonTableRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <SkeletonLine width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({
  cols = 4,
  rows = 5,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
        <SkeletonLine width="120px" className="h-5" />
        <SkeletonLine width="200px" className="h-9 rounded-xl" />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)]">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="text-left px-5 py-3">
                <SkeletonLine width="60px" className="h-3" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header skeleton */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <SkeletonLine width="120px" className="h-6 bg-white/20" />
            <SkeletonLine width="80px" className="h-8 rounded-lg bg-white/10" />
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6 space-y-2">
          <SkeletonLine width="180px" className="h-3" />
          <SkeletonLine width="140px" className="h-7" />
        </div>
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header skeleton */}
      <header className="bg-[var(--color-primary-dark)] text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 animate-pulse" />
            <div className="space-y-1">
              <SkeletonLine width="120px" className="h-5 bg-white/20" />
              <SkeletonLine width="80px" className="h-3 bg-white/10" />
            </div>
          </div>
          <SkeletonLine width="100px" className="h-8 rounded-lg bg-white/10" />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)]"
            >
              <div className="h-9 w-9 rounded-xl bg-[var(--color-border)] animate-pulse mb-3" />
              <SkeletonLine width="60px" className="h-7 mb-1" />
              <SkeletonLine width="80px" className="h-3" />
            </div>
          ))}
        </div>
        <SkeletonTable cols={6} rows={5} />
      </main>
    </div>
  );
}

export function StudentSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header skeleton */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <SkeletonLine width="140px" className="h-6 bg-white/20" />
            <SkeletonLine width="80px" className="h-8 rounded-lg bg-white/10" />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-8">
          <SkeletonLine width="200px" className="h-7 mb-4" />
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-10">
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[var(--color-border)] animate-pulse mb-3" />
              <SkeletonLine width="180px" className="h-4" />
            </div>
          </div>
        </div>
        <SkeletonLine width="200px" className="h-7 mb-4" />
        <SkeletonTable cols={6} rows={4} />
      </main>
    </div>
  );
}

export function CourseSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header skeleton */}
      <header className="bg-[var(--color-primary)] text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <SkeletonLine width="60px" className="h-4 bg-white/20" />
          <div className="h-4 w-px bg-white/20" />
          <SkeletonLine width="100px" className="h-4 bg-white/20" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <SkeletonLine width="100px" className="h-4" />
          <SkeletonLine width="80px" className="h-4" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border-2 border-[var(--color-border-light)] bg-[var(--color-surface-card)]"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-border)] animate-pulse" />
                  <div className="space-y-1">
                    <SkeletonLine width="140px" className="h-4" />
                    <SkeletonLine width="70px" className="h-3" />
                  </div>
                </div>
                <SkeletonLine width="60px" className="h-7 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
