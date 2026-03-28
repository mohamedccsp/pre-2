import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Loading skeleton placeholder
 * @param className - Additional CSS classes
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/50',
        className
      )}
    />
  );
}

/**
 * Table skeleton showing loading state for coin list
 */
export function CoinTableSkeleton() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <div className="ml-auto flex gap-8">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24 hidden md:block" />
          </div>
        </div>
      ))}
    </div>
  );
}
