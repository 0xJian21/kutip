import { Skeleton } from "@/components/ui/states";

/** Its own skeleton: without it the invoice list's placeholder showed while the form loaded. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading new invoice">
      <Skeleton className="mb-2 h-8 w-44" />
      <Skeleton className="mb-8 h-3.5 w-96 max-w-full" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6">
        <div className="space-y-5 rounded-xl bg-surface p-6 shadow-card">
          <Skeleton className="h-5 w-36" />
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-full rounded-md" /></div>
          ))}
          <Skeleton className="h-24 w-full rounded-md" />
          <div className="flex justify-end gap-2"><Skeleton className="h-10 w-28 rounded-full" /><Skeleton className="h-10 w-32 rounded-full" /></div>
        </div>
        <Skeleton className="hidden h-[520px] rounded-xl lg:block" />
      </div>
    </div>
  );
}
