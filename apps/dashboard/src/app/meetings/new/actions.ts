"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createMeeting, type MeetingLocationType } from "@/lib/meetings";

export interface CreateMeetingState {
  ok: boolean;
  error?: string;
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMeetingAction(_prevState: CreateMeetingState, formData: FormData): Promise<CreateMeetingState> {
  const title = readText(formData, "title");
  const locationType = readText(formData, "location_type") as MeetingLocationType;
  const locationValue = readText(formData, "location_value");
  const date = readText(formData, "date");
  const time = readText(formData, "time");
  const withName = readText(formData, "with_name");
  const organizerAgentId = readText(formData, "organizer_agent_id");
  const notes = readText(formData, "notes");

  if (!title) return { ok: false, error: "Title is required." };
  if (locationType !== "online" && locationType !== "physical") return { ok: false, error: "Choose online or physical." };
  if (!locationValue) {
    return { ok: false, error: locationType === "online" ? "Add a video call link." : "Add an address." };
  }
  if (!date || !time) return { ok: false, error: "Choose a date and time." };

  const startsAt = new Date(`${date}T${time}`);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Invalid date/time." };

  try {
    await createMeeting({
      title,
      location_type: locationType,
      location_value: locationValue,
      starts_at: startsAt.toISOString(),
      with_name: withName || null,
      organizer_agent_id: organizerAgentId || null,
      notes: notes || null,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create meeting." };
  }

  revalidatePath("/meetings");
  revalidatePath("/");
  redirect("/meetings");
}
