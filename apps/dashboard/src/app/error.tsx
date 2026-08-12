/**
 * Global error boundary. Real errors likely to hit this in practice right
 * now: DATABASE_URL unset/unreachable, or the shared schema not applied yet
 * (see src/lib/db.ts -- this app deliberately doesn't auto-provision it).
 */
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <p className="max-w-md text-xs text-muted-foreground">
        If this is a database connection error, check that <code>DATABASE_URL</code> is set and
        points at a database with the shared schema applied -- see apps/dashboard/.env.example.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
