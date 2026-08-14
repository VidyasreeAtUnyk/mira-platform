"use client";

import { useActionState, useState } from "react";
import type { Agent } from "@mira/shared-types";
import { createMeetingAction, type CreateMeetingState } from "./actions";
import type { MeetingLocationType } from "@/lib/meetings";

const initialState: CreateMeetingState = { ok: false };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MeetingForm({ agents }: { agents: Agent[] }) {
  const [state, formAction, pending] = useActionState(createMeetingAction, initialState);
  const [locationType, setLocationType] = useState<MeetingLocationType>("online");

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-card p-4">
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Title *</label>
        <input
          name="title"
          required
          placeholder="e.g. Sobha Realty partner check-in"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">With (optional)</label>
        <input
          name="with_name"
          placeholder="e.g. Sobha Realty partner desk, or a team member's name"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date *</label>
          <input
            name="date"
            type="date"
            required
            defaultValue={todayIso()}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Time *</label>
          <input
            name="time"
            type="time"
            required
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Location *</label>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setLocationType("online")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              locationType === "online" ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Online
          </button>
          <button
            type="button"
            onClick={() => setLocationType("physical")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              locationType === "physical" ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Physical
          </button>
        </div>
        <input type="hidden" name="location_type" value={locationType} />
        <input
          name="location_value"
          required
          placeholder={locationType === "online" ? "Video call link (Zoom, Meet, Teams…)" : "Address"}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Organizer (optional)</label>
        <select name="organizer_agent_id" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Add to calendar"}
      </button>
    </form>
  );
}
