import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading payment" className="mx-auto w-full max-w-md px-4 pt-14">
      <div className="rounded-lg border border-line bg-surface p-6">
        <Skeleton className="mx-auto h-3.5 w-40" />
        <Skeleton className="mx-auto mt-3 h-4 w-32" />
        <Skeleton className="mx-auto mt-4 h-12 w-48" />
        <Skeleton className="mx-auto mt-6 aspect-square w-56" />
        <Skeleton className="mt-6 h-12 w-full" />
      </div>
    </main>
  );
}
