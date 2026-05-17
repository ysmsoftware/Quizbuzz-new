export function CardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="h-4 bg-muted animate-skeleton rounded w-3/4" />
      <div className="h-4 bg-muted animate-skeleton rounded w-1/2" />
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-muted animate-skeleton rounded" />
        <div className="h-3 bg-muted animate-skeleton rounded w-5/6" />
      </div>
    </div>
  );
}
