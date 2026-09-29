import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading calendar">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-44 rounded-full" />
      </div>
      <div className="divide-y divide-line rounded-xl bg-surface shadow-card">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="grid gap-2 px-5 py-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:px-6">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-6 w-full max-w-md rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
