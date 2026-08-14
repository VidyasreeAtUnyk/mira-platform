"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgentOption, LeadOption } from "@/lib/directory";

interface NewTransactionFormProps {
  leads: LeadOption[];
  agents: AgentOption[];
}

export function NewTransactionForm({ leads, agents }: NewTransactionFormProps) {
  const router = useRouter();
  const [leadId, setLeadId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) {
      setError("Choose a lead to start this deal against.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/pipeline/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          agent_id: agentId || undefined,
          offer_price: offerPrice ? Number(offerPrice) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Failed to create deal (${res.status})`);
      }
      const { transaction } = await res.json();
      router.push(`/transactions/${transaction.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Lead *</label>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          required
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Select a lead…</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.phone} ({l.stage})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Agent (optional)</label>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Offer price (optional)</label>
        <input
          type="number"
          min="0"
          step="any"
          value={offerPrice}
          onChange={(e) => setOfferPrice(e.target.value)}
          placeholder="AED"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create deal"}
      </button>
    </form>
  );
}
