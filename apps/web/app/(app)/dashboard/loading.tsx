import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="grid gap-6 rounded-md border border-line bg-surface p-6 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <div className="grid gap-5 sm:col-span-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-md border border-line bg-surface"><SkeletonRows rows={4} /></div>
        <div className="rounded-md border border-line bg-surface"><SkeletonRows rows={4} /></div>
      </div>
    </div>
  );
}
