import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, ready } from "@/lib/db";
import { transitionTransaction } from "@/lib/transactions";
import { IllegalStageTransitionError, PIPELINE_STAGES } from "@/lib/stage-machine";
import { pgUuid } from "@/lib/validation";

const transitionSchema = z.object({
  to_stage: z.enum(PIPELINE_STAGES),
  changed_by: pgUuid.optional(),
  note: z.string().optional(),
  lost_reason: z.string().optional(),
  offer_price: z.number().positive().optional(),
  contract_price: z.number().positive().optional(),
  expected_closing_date: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await ready();
  const body = await req.json();
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const transaction = await transitionTransaction(db, id, parsed.data);
    return NextResponse.json({ transaction });
  } catch (err) {
    if (err instanceof IllegalStageTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.startsWith("No transaction found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
