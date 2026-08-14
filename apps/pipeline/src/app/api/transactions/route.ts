import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, ready } from "@/lib/db";
import { createTransaction, listTransactions } from "@/lib/transactions";
import { PIPELINE_STAGES } from "@/lib/stage-machine";
import { pgUuid } from "@/lib/validation";

const createSchema = z.object({
  lead_id: pgUuid,
  property_id: pgUuid.optional(),
  agent_id: pgUuid.optional(),
  offer_price: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const db = getDb();
  await ready();
  const stageParam = req.nextUrl.searchParams.get("stage");
  if (stageParam && !PIPELINE_STAGES.includes(stageParam as (typeof PIPELINE_STAGES)[number])) {
    return NextResponse.json({ error: `Invalid stage '${stageParam}'` }, { status: 400 });
  }
  const transactions = await listTransactions(db, {
    stage: stageParam as (typeof PIPELINE_STAGES)[number] | undefined,
  });
  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  await ready();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const transaction = await createTransaction(db, parsed.data);
  return NextResponse.json({ transaction }, { status: 201 });
}
