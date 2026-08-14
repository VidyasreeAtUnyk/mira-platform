"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PIPELINE_STAGES, PIPELINE_STAGE_EDGES, type PipelineStage } from "@/lib/stage-machine";
import type { TransactionWithLead } from "@/types";

const STAGE_LABELS: Record<PipelineStage, string> = {
  showing: "Showing",
  offer: "Offer",
  under_contract: "Under Contract",
  inspection: "Inspection",
  closing: "Closing",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

interface PipelineBoardProps {
  transactions: TransactionWithLead[];
}

/**
 * Client island for the board's interactive bits (drag-and-drop stage
 * changes) -- the page itself stays an async Server Component fetching real
 * data, same split used throughout this codebase (dashboard, comms-hub).
 * Drag-and-drop uses the native HTML5 DnD API rather than adding a library:
 * one dimension (drop into a column = change stage), a handful of columns,
 * no reordering within a column -- doesn't need more than that.
 */
export function PipelineBoard({ transactions }: PipelineBoardProps) {
  const router = useRouter();
  const [draggingStage, setDraggingStage] = useState<PipelineStage | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [pendingMove, setPendingMove] = useState<{ id: string; toStage: PipelineStage } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as TransactionWithLead[]])) as Record<
      PipelineStage,
      TransactionWithLead[]
    >;
    for (const t of transactions) map[t.stage].push(t);
    return map;
  }, [transactions]);

  async function applyTransition(id: string, toStage: PipelineStage, extra?: { lost_reason?: string }) {
    setBusyId(id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/pipeline/api/transactions/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_stage: toStage, ...extra }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Transition failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Transition failed.");
    } finally {
      setBusyId(null);
    }
  }

  function handleDrop(toStage: PipelineStage, id: string, fromStage: PipelineStage) {
    setDragOverStage(null);
    setDraggingStage(null);
    if (fromStage === toStage) return;
    if (!PIPELINE_STAGE_EDGES[fromStage].includes(toStage)) return; // invalid target, dropzone already disabled this
    if (toStage === "closed_lost") {
      setPendingMove({ id, toStage });
      setLostReason("");
      return;
    }
    void applyTransition(id, toStage);
  }

  return (
    <div>
      {errorMessage && (
        <div className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const isValidDropTarget = draggingStage != null && PIPELINE_STAGE_EDGES[draggingStage].includes(stage);
          const isDragging = draggingStage != null;
          return (
            <div
              key={stage}
              className={`min-w-64 flex-shrink-0 rounded-lg border transition-colors ${
                dragOverStage === stage && isValidDropTarget
                  ? "border-primary bg-primary/10"
                  : "border-border"
              } ${isDragging && !isValidDropTarget ? "opacity-40" : ""}`}
              onDragOver={(e) => {
                if (!isValidDropTarget) return;
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/transaction-id");
                const fromStage = e.dataTransfer.getData("text/from-stage") as PipelineStage;
                if (id && fromStage) handleDrop(stage, id, fromStage);
              }}
            >
              <div className="border-b border-border px-3 py-2 text-sm font-medium">
                {STAGE_LABELS[stage]} ({byStage[stage].length})
              </div>
              <div className="flex flex-col gap-2 p-3">
                {byStage[stage].map((t) => (
                  <Link
                    key={t.id}
                    href={`/transactions/${t.id}`}
                    draggable={!isTerminalCard(stage)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/transaction-id", t.id);
                      e.dataTransfer.setData("text/from-stage", stage);
                      setDraggingStage(stage);
                    }}
                    onDragEnd={() => {
                      setDraggingStage(null);
                      setDragOverStage(null);
                    }}
                    className={`block rounded border border-border bg-card p-2 text-xs hover:border-primary/40 hover:bg-primary/5 ${
                      busyId === t.id ? "opacity-50" : ""
                    } ${!isTerminalCard(stage) ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <div className="font-medium text-foreground">
                      {t.lead_name ?? "(lead not found)"}
                    </div>
                    {t.lead_phone && <div className="text-muted-foreground">{t.lead_phone}</div>}
                    {t.offer_price != null && <div>Offer: AED {t.offer_price.toLocaleString()}</div>}
                    {t.expected_closing_date && <div>Closing: {t.expected_closing_date}</div>}
                  </Link>
                ))}
                {byStage[stage].length === 0 && <div className="text-xs text-muted-foreground/70">No deals</div>}
              </div>
            </div>
          );
        })}
      </div>

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg">
            <h2 className="text-sm font-semibold text-foreground">Mark as Closed Lost</h2>
            <p className="mt-1 text-xs text-muted-foreground">A reason is required before this deal can move to Closed Lost.</p>
            <textarea
              autoFocus
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Buyer's financing fell through"
              rows={3}
              className="mt-3 w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPendingMove(null)}
                className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                disabled={!lostReason.trim()}
                onClick={() => {
                  const move = pendingMove;
                  setPendingMove(null);
                  if (move) void applyTransition(move.id, move.toStage, { lost_reason: lostReason.trim() });
                }}
                className="rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isTerminalCard(stage: PipelineStage): boolean {
  return PIPELINE_STAGE_EDGES[stage].length === 0;
}
