"use client";

import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState title="Couldn't load this page" message={error.message} retry={retry} />;
}
