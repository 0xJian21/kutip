import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading inbox">
      <Skeleton className="mb-2 h-8 w-28" />
      <Skeleton className="mb-8 h-3.5 w-full max-w-xl" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
        <div className="rounded-xl bg-surface shadow-card"><SkeletonRows rows={6} /></div>
        <div className="hidden space-y-4 rounded-xl bg-surface p-6 shadow-card lg:block">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-40" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className={`h-20 rounded-lg ${i % 2 ? "ml-auto w-3/4" : "w-3/4"}`} />)}
        </div>
      </div>
    </div>
  );
}
