"use client";

import type { ReactNode } from "react";
import { Button } from "./button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-paper-2 ${className}`} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  compact = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-start ${compact ? "px-4 py-6 sm:px-6" : "px-6 py-12"}`}>
      <p className="text-md font-medium text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-[48ch] text-base text-ink-2">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  message,
  retry,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start rounded-md border border-disputed-fg/30 bg-disputed-bg/40 px-6 py-8">
      <p className="text-md font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-[48ch] text-base text-ink-2">
        {message ?? "Check your connection and try again. Nothing has been changed."}
      </p>
      {retry ? (
        <Button variant="secondary" className="mt-4" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
