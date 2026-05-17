export function LeaderboardSkeleton({ rows = 10 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg">
          {/* Rank */}
          <div className="w-8 h-8 bg-muted animate-skeleton rounded" />
          {/* Avatar */}
          <div className="w-10 h-10 bg-muted animate-skeleton rounded-full" />
          {/* Name and Score */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted animate-skeleton rounded w-1/2" />
            <div className="h-3 bg-muted animate-skeleton rounded w-1/3" />
          </div>
          {/* Score */}
          <div className="h-5 w-16 bg-muted animate-skeleton rounded" />
        </div>
      ))}
    </div>
  );
}
