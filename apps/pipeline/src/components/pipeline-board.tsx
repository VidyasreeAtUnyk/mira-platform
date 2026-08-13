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
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
                  ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950"
                  : "border-neutral-200 dark:border-neutral-800"
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
              <div className="border-b border-neutral-200 px-3 py-2 text-sm font-medium dark:border-neutral-800">
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
                    className={`block rounded border border-neutral-200 p-2 text-xs hover:border-blue-300 hover:bg-blue-50/50 dark:border-neutral-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 ${
                      busyId === t.id ? "opacity-50" : ""
                    } ${!isTerminalCard(stage) ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <div className="font-medium text-neutral-800 dark:text-neutral-100">
                      {t.lead_name ?? "(lead not found)"}
                    </div>
                    {t.lead_phone && <div className="text-neutral-500">{t.lead_phone}</div>}
                    {t.offer_price != null && <div>Offer: AED {t.offer_price.toLocaleString()}</div>}
                    {t.expected_closing_date && <div>Closing: {t.expected_closing_date}</div>}
                  </Link>
                ))}
                {byStage[stage].length === 0 && <div className="text-xs text-neutral-400">No deals</div>}
              </div>
            </div>
          );
        })}
      </div>

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold">Mark as Closed Lost</h2>
            <p className="mt-1 text-xs text-neutral-500">A reason is required before this deal can move to Closed Lost.</p>
            <textarea
              autoFocus
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Buyer's financing fell through"
              rows={3}
              className="mt-3 w-full rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPendingMove(null)}
                className="rounded px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
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
