"use server";

/**
 * App-wide server actions -- viewer switching, and the two mutations that
 * used to live on src/components/comms-store.tsx (now deleted, see
 * PROGRESS-integration.md). Every mutation here routes through
 * src/lib/data/comms.ts, which only ever writes status: 'draft' -- see
 * that file's header for why that's still true by construction, not
 * convention, now that this is a real database instead of in-memory state.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { VIEWER_COOKIE_NAME } from "@/lib/auth/viewer";
import { addReplyDraft, createDraftThread, listViewers, type NewThreadInput } from "@/lib/data/comms";

export async function setViewerAction(formData: FormData): Promise<void> {
  const agentId = formData.get("agentId");
  if (typeof agentId !== "string") return;
  const viewers = await listViewers();
  if (!viewers.some((v) => v.agentId === agentId)) return;

  const store = await cookies();
  store.set(VIEWER_COOKIE_NAME, agentId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}

export async function addReplyDraftAction(threadId: string, formData: FormData): Promise<void> {
  const body = formData.get("body");
  if (typeof body !== "string" || body.trim().length === 0) return;
  await addReplyDraft(threadId, body);
  revalidatePath(`/thread/${threadId}`);
  revalidatePath("/");
}

export async function createDraftThreadAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const channel = formData.get("channel");
  const contactName = formData.get("contactName");
  const contactHandle = formData.get("contactHandle");
  const subject = formData.get("subject");
  const body = formData.get("body");
  const agentId = formData.get("agentId");

  if (channel !== "whatsapp" && channel !== "email") {
    return { error: "Invalid channel." };
  }
  if (
    typeof contactName !== "string" ||
    !contactName.trim() ||
    typeof contactHandle !== "string" ||
    !contactHandle.trim() ||
    typeof body !== "string" ||
    !body.trim()
  ) {
    return { error: "Contact name, contact handle, and message body are all required." };
  }
  if (channel === "email" && (typeof subject !== "string" || !subject.trim())) {
    return { error: "Subject is required for email threads." };
  }

  const input: NewThreadInput = {
    channel,
    contactName,
    contactHandle,
    subject: channel === "email" ? (subject as string) : null,
    body,
    agentId: typeof agentId === "string" && agentId.length > 0 ? agentId : null,
  };

  const threadId = await createDraftThread(input);
  revalidatePath("/");
  redirect(`/thread/${threadId}`);
}
