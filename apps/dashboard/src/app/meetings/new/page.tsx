import Link from "next/link";
import { getAgents } from "@/lib/queries";
import { MeetingForm } from "./meeting-form";

export const revalidate = 0;

export default async function NewMeetingPage() {
  const agents = await getAgents();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <Link href="/meetings" className="text-xs text-muted-foreground hover:underline">
          &larr; Back to meetings
        </Link>
        <h1 className="mb-1 mt-3 text-xl font-bold tracking-tight">New meeting</h1>
        <p className="mb-4 text-xs text-muted-foreground">Online or physical -- your own calendar entry.</p>
        <MeetingForm agents={agents} />
      </div>
    </div>
  );
}
