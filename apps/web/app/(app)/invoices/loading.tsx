import { Skeleton, SkeletonRows } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading invoices">
      <div className="mb-8 flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mb-4 flex gap-2">
        {[16, 28, 20, 16, 18].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full" width={`${w / 4}rem`} />
        ))}
      </div>
      <div className="rounded-xl bg-surface shadow-card"><SkeletonRows rows={8} /></div>
    </div>
  );
}
