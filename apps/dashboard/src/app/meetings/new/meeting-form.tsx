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
  const agentNamesById = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border bg-card p-4">
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      {state.conflicts && state.conflicts.length > 0 && (
        <div className="rounded border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="mb-1.5 font-medium text-warning">
            This overlaps {state.conflicts.length === 1 ? "an existing meeting" : `${state.conflicts.length} existing meetings`} for someone on this invite:
          </p>
          <ul className="mb-2 space-y-1 text-muted-foreground">
            {state.conflicts.map((c) => (
              <li key={c.meetingId}>
                "{c.title}" — {new Date(c.startsAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                {" – "}
                {new Date(c.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                {" for "}
                {c.conflictingAgentIds.map((id) => agentNamesById.get(id) ?? "someone").join(", ")}
              </li>
            ))}
          </ul>
          <button
            type="submit"
            name="force"
            value="true"
            disabled={pending}
            className="rounded border border-warning/50 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10 disabled:opacity-40"
          >
            Create anyway
          </button>
        </div>
      )}

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
        <label className="mb-1 block text-xs font-medium text-muted-foreground">With (optional, free text -- external people not in this system)</label>
        <input
          name="with_name"
          placeholder="e.g. Sobha Realty partner desk"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Start *</label>
          <input
            name="time"
            type="time"
            required
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">End (optional, defaults +1h)</label>
          <input
            name="end_time"
            type="time"
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
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Attendees (optional -- real team members only; they don't get emailed, but the meeting shows on this list for anyone to see)
        </label>
        <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-border bg-background p-2">
          {agents.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="attendee_agent_ids" value={a.id} className="accent-primary" />
              {a.name}
            </label>
          ))}
        </div>
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
