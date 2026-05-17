export function DashboardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="p-4 border rounded-lg space-y-3">
          <div className="h-4 bg-muted animate-skeleton rounded w-3/4" />
          <div className="h-8 bg-muted animate-skeleton rounded w-1/2" />
          <div className="h-3 bg-muted animate-skeleton rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
