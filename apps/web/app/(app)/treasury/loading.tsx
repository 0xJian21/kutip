import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading treasury">
      <Skeleton className="mb-2 h-7 w-32" />
      <Skeleton className="mb-8 h-3.5 w-96" />
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-6">
          <div className="rounded-xl bg-surface shadow-card p-6"><Skeleton className="mb-3 h-3.5 w-20" /><Skeleton className="h-12 w-64" /></div>
          <div className="rounded-xl bg-surface shadow-card"><SkeletonRows rows={5} /></div>
        </div>
        <div className="rounded-xl bg-surface shadow-card"><SkeletonRows rows={4} /></div>
      </div>
    </div>
  );
}
