import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem, ModuleKey } from "@/lib/roles";

/**
 * Extracted from app/page.tsx so the same nav renders on /meetings too
 * (previously this JSX only existed inline on the Today page, since that
 * was the only route in this app -- meetings is the second).
 */
export function NavPills({ nav, active }: { nav: NavItem[]; active: ModuleKey }) {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {nav.map((item) => {
        const isActive = item.key === active;
        const pillClass = cn(
          "rounded-full border px-2.5 py-1 text-xs font-medium",
          isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
        );
        if (item.status !== "live" || !item.href) {
          return (
            <span key={item.key} className={pillClass}>
              {item.label}
              {item.status === "planned" && <span className="ml-1 text-[10px] opacity-70">(soon)</span>}
            </span>
          );
        }
        if (item.zone === "same") {
          return (
            <Link key={item.key} href={item.href} className={cn(pillClass, "transition-colors hover:bg-accent")}>
              {item.label}
            </Link>
          );
        }
        // Cross-zone (Next.js Multi-Zones, see next.config.ts's rewrites) --
        // a different app entirely, so a plain <a> is correct here, not
        // next/link's Link.
        return (
          <a key={item.key} href={item.href} className={cn(pillClass, "transition-colors hover:bg-accent")}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
