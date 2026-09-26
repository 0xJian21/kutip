import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading rulebook" className="max-w-3xl">
      <Skeleton className="mb-2 h-7 w-32" />
      <Skeleton className="mb-8 h-3.5 w-80" />
      {[0, 1].map((p) => (
        <div key={p} className="mb-6 rounded-md border border-line bg-surface p-6">
          <Skeleton className="mb-5 h-5 w-32" />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="mb-4 h-4 w-full max-w-lg" />)}
        </div>
      ))}
    </div>
  );
}
