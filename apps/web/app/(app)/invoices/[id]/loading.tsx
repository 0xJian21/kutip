import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading invoice">
      <Skeleton className="mb-4 h-3.5 w-16" />
      <div className="mb-8 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="rounded-md border border-line bg-surface p-6">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-md border border-line bg-surface"><SkeletonRows rows={3} /></div>
        <div className="rounded-md border border-line bg-surface"><SkeletonRows rows={4} /></div>
      </div>
    </div>
  );
}
