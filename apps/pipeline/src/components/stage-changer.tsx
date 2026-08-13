"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PIPELINE_STAGE_EDGES, type PipelineStage } from "@/lib/stage-machine";

const STAGE_LABELS: Record<PipelineStage, string> = {
  showing: "Showing",
  offer: "Offer",
  under_contract: "Under Contract",
  inspection: "Inspection",
  closing: "Closing",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

interface StageChangerProps {
  transactionId: string;
  currentStage: PipelineStage;
}

/** Dropdown + confirm form for changing a single transaction's stage from its detail page -- same transition API the board's drag-and-drop calls. */
export function StageChanger({ transactionId, currentStage }: StageChangerProps) {
  const router = useRouter();
  const nextStages = PIPELINE_STAGE_EDGES[currentStage];
  const [selected, setSelected] = useState<PipelineStage | "">("");
  const [lostReason, setLostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nextStages.length === 0) {
    return <p className="text-sm text-neutral-500">This deal is closed -- no further transitions.</p>;
  }

  async function submit() {
    if (!selected) return;
    if (selected === "closed_lost" && !lostReason.trim()) {
      setError("A reason is required to mark this deal Closed Lost.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/pipeline/api/transactions/${transactionId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_stage: selected,
          ...(selected === "closed_lost" ? { lost_reason: lostReason.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Transition failed (${res.status})`);
      }
      router.refresh();
      setSelected("");
      setLostReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as PipelineStage | "")}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">Move to…</option>
          {nextStages.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        {selected === "closed_lost" && (
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Reason (required)"
            className="min-w-48 flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        )}
        <button
          onClick={submit}
          disabled={!selected || busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
