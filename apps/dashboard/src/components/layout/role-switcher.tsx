import Link from "next/link";
import { cn } from "@/lib/utils";
import { AGENT_ROLES, ROLE_LABELS, type DashboardRole } from "@/lib/roles";

/**
 * Dev-only "view as role" switcher -- NOT auth, NOT a role picker for a real
 * user. Changes only which nav items / role-scoped notes render on this
 * page (see src/lib/roles.ts). Every link is a plain `?role=` query param;
 * there is no session anywhere in this app yet. Real auth + role assignment
 * is tracked as a Next step in PROGRESS-dashboard.md.
 */
export function RoleSwitcher({ current }: { current: DashboardRole }) {
  return (
    <div className="rounded-lg border border-dashed border-warning/50 bg-warning/10 px-3 py-2 text-xs">
      <p className="mb-1.5 font-medium text-warning-foreground">
        Dev preview only -- no auth wired up yet. Viewing as:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {AGENT_ROLES.map((role) => (
          <Link
            key={role}
            href={`/?role=${role}`}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              role === current
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            {ROLE_LABELS[role]}
          </Link>
        ))}
      </div>
    </div>
  );
}
