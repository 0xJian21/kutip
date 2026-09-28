import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="grid gap-6 rounded-xl bg-surface p-6 shadow-card sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-12 w-full rounded-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="rounded-xl bg-surface shadow-card"><SkeletonRows rows={4} /></div>
        </div>
        <div className="grid content-start gap-6">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="rounded-xl bg-surface shadow-card"><SkeletonRows rows={3} /></div>
        </div>
      </div>
    </div>
  );
}
