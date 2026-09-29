import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading agent permissions">
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="mb-8 h-3.5 w-72 max-w-full" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div className="space-y-5 rounded-xl bg-surface p-6 shadow-card">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-4"><Skeleton className="h-14 w-14 rounded-md" /><Skeleton className="h-9 w-32 rounded-full" /></div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-full rounded-md" /></div>
          ))}
        </div>
        <div className="space-y-3 rounded-xl bg-surface p-6 shadow-card">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
    </div>
  );
}
