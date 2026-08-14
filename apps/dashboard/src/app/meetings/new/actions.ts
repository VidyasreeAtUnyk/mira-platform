"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createMeeting, findConflicts, type Conflict, type MeetingLocationType } from "@/lib/meetings";

export interface CreateMeetingState {
  ok: boolean;
  error?: string;
  conflicts?: Conflict[];
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const DEFAULT_DURATION_MINUTES = 60;

export async function createMeetingAction(_prevState: CreateMeetingState, formData: FormData): Promise<CreateMeetingState> {
  const title = readText(formData, "title");
  const locationType = readText(formData, "location_type") as MeetingLocationType;
  const locationValue = readText(formData, "location_value");
  const date = readText(formData, "date");
  const time = readText(formData, "time");
  const endTime = readText(formData, "end_time");
  const withName = readText(formData, "with_name");
  const organizerAgentId = readText(formData, "organizer_agent_id");
  const notes = readText(formData, "notes");
  const attendeeAgentIds = formData.getAll("attendee_agent_ids").filter((v): v is string => typeof v === "string" && v.length > 0);
  const force = readText(formData, "force") === "true";

  if (!title) return { ok: false, error: "Title is required." };
  if (locationType !== "online" && locationType !== "physical") return { ok: false, error: "Choose online or physical." };
  if (!locationValue) {
    return { ok: false, error: locationType === "online" ? "Add a video call link." : "Add an address." };
  }
  if (!date || !time) return { ok: false, error: "Choose a date and time." };

  const startsAt = new Date(`${date}T${time}`);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Invalid date/time." };

  const endsAt = endTime
    ? new Date(`${date}T${endTime}`)
    : new Date(startsAt.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { ok: false, error: "End time must be after the start time." };
  }

  // Conflict check across organizer + every attendee -- real interval-
  // overlap math (see findConflicts), not just the organizer's own
  // calendar. Skipped when the user explicitly confirmed "Create anyway".
  if (!force) {
    const checkAgentIds = [organizerAgentId, ...attendeeAgentIds].filter((id): id is string => Boolean(id));
    if (checkAgentIds.length > 0) {
      const conflicts = await findConflicts(checkAgentIds, startsAt.toISOString(), endsAt.toISOString());
      if (conflicts.length > 0) {
        return { ok: false, conflicts };
      }
    }
  }

  try {
    await createMeeting({
      title,
      location_type: locationType,
      location_value: locationValue,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      with_name: withName || null,
      organizer_agent_id: organizerAgentId || null,
      notes: notes || null,
      attendeeAgentIds,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create meeting." };
  }

  revalidatePath("/meetings");
  revalidatePath("/");
  redirect("/meetings");
}
