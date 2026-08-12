import Link from "next/link";
import type { Agent } from "@mira/shared-types";
import { SignOutButton } from "./sign-out-button";

export function AppShell({ agent, children }: { agent: Agent | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              M
            </div>
            <span className="font-semibold text-sm">Mira Trackers</span>
          </Link>
          <div className="flex items-center gap-3">
            {agent && (
              <span className="hidden sm:block text-xs text-muted-foreground">
                {agent.name} <span className="text-muted-foreground/60">· {agent.role}</span>
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
