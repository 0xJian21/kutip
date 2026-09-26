import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading agent activity">
      <Skeleton className="mb-2 h-7 w-44" />
      <Skeleton className="mb-8 h-3.5 w-96" />
      <div className="mb-4 flex gap-2">{[10, 36, 32, 16].map((w, i) => <Skeleton key={i} className={`h-8 w-${w}`} />)}</div>
      <div className="rounded-md border border-line bg-surface"><SkeletonRows rows={6} /></div>
    </div>
  );
}
