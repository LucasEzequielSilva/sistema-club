import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_384px] gap-4 items-start">
        <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-11 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
