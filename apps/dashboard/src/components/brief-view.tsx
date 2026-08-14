"use client";

import { useState } from "react";
import type { NotificationTier } from "@mira/shared-types";
import type { Brief, AttentionItem } from "@/lib/brief";
import type { PlannedItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

const MOOD_STYLE: Record<Brief["mood"], { bg: string; text: string; emoji: string }> = {
  strong: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", emoji: "📈" },
  steady: { bg: "bg-primary/5", text: "text-primary", emoji: "🙂" },
  busy: { bg: "bg-warning/10", text: "text-warning-foreground", emoji: "⚡" },
  quiet: { bg: "bg-muted", text: "text-muted-foreground", emoji: "☕" },
};

const TIER_DOT: Record<NotificationTier, string> = {
  urgent: "bg-red-500",
  today: "bg-warning",
  fyi: "bg-muted-foreground/40",
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const body = (
    <>
      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TIER_DOT[item.tier])} />
      <span className="min-w-0 flex-1 truncate">{item.text}</span>
      {item.href ? (
        <span className="shrink-0 text-xs text-primary">View →</span>
      ) : (
        <span className="shrink-0 text-[10px] italic text-muted-foreground/60">{item.noLinkReason}</span>
      )}
    </>
  );
  return item.href ? (
    <a href={item.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">{body}</div>
  );
}

function PlannedRow({ item }: { item: PlannedItem }) {
  const dateLabel = new Date(item.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const body = (
    <>
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{dateLabel}</span>
      <span className="min-w-0 flex-1 truncate">{item.text}</span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">{item.source}</span>
      {item.href && <span className="shrink-0 text-xs text-primary">View →</span>}
    </>
  );
  return item.href ? (
    <a href={item.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm" title={item.noLinkReason}>
      {body}
    </div>
  );
}

export function BriefView({ brief, planned }: { brief: Brief; planned: PlannedItem[] }) {
  const [tab, setTab] = useState<"today" | "planned">("today");
  const style = MOOD_STYLE[brief.mood];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("today")}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "today" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
          )}
        >
          Today
        </button>
        <button
          onClick={() => setTab("planned")}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "planned" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
          )}
        >
          Planned {planned.length > 0 && <span className="text-muted-foreground">({planned.length})</span>}
        </button>
      </div>

      {tab === "today" ? (
        <div className={cn("rounded-xl p-4", style.bg)}>
          <p className={cn("mb-1 text-base font-semibold", style.text)}>
            {style.emoji} {brief.headline}
          </p>
          <p className="mb-3 text-sm leading-relaxed text-foreground/80">{brief.summary}</p>

          {brief.attention.length > 0 ? (
            <div className="rounded-lg border border-border/60 bg-card/60">
              <p className="border-b border-border/60 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Needs attention
              </p>
              <div className="divide-y divide-border/40">
                {brief.attention.map((item, i) => (
                  <AttentionRow key={i} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          {planned.length > 0 ? (
            <div className="divide-y divide-border/40">
              {planned.map((item, i) => (
                <PlannedRow key={i} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled in the next 7 days.</p>
          )}
        </div>
      )}
    </div>
  );
}
