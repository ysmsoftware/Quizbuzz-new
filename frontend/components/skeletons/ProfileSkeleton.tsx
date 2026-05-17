export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-24 h-24 bg-muted animate-skeleton rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="h-6 bg-muted animate-skeleton rounded w-1/3" />
          <div className="h-4 bg-muted animate-skeleton rounded w-1/2" />
          <div className="h-4 bg-muted animate-skeleton rounded w-2/3" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-muted animate-skeleton rounded" />
        <div className="h-4 bg-muted animate-skeleton rounded" />
        <div className="h-4 bg-muted animate-skeleton rounded w-4/5" />
      </div>
    </div>
  );
}
