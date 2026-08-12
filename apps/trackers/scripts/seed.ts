/**
 * Seeds apps/trackers' scratch local Postgres with a realistic set of
 * agents, goals, and progress entries -- used to verify pages render and
 * CRUD/aggregation work against real data (see PROGRESS-trackers.md).
 * Run: npm run seed --workspace=trackers   (or `npm run seed` from apps/trackers)
 */

import { getDb, ready, closeDb, DEFAULT_DATABASE_URL } from "../src/lib/db";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndIso(): string {
  const d = new Date();
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

async function main() {
  const pool = getDb();
  await ready();

  console.log(`Seeding ${process.env.DATABASE_URL || DEFAULT_DATABASE_URL} ...`);

  // Wipe trackers-owned data only -- leave any other shared-schema rows
  // (agents included, since crm/lead-agent may share this database in a
  // combined dev setup) untouched, except the specific seed agents we own.
  await pool.query("TRUNCATE goal_progress_entries, goals CASCADE");
  await pool.query(
    "DELETE FROM agents WHERE email IN ('sana.malik@mira.example', 'farah.hussain@mira.example', 'omar.saeed@mira.example')"
  );

  const managerResult = await pool.query<{ id: string }>(
    `insert into agents (name, email, phone, role) values ($1, $2, $3, 'manager') returning id`,
    ["Sana Malik", "sana.malik@mira.example", "+971501110001"]
  );
  const manager = managerResult.rows[0].id;

  const farahResult = await pool.query<{ id: string }>(
    `insert into agents (name, email, phone, role) values ($1, $2, $3, 'agent') returning id`,
    ["Farah Hussain", "farah.hussain@mira.example", "+971501110002"]
  );
  const farah = farahResult.rows[0].id;

  const omarResult = await pool.query<{ id: string }>(
    `insert into agents (name, email, phone, role) values ($1, $2, $3, 'agent') returning id`,
    ["Omar Saeed", "omar.saeed@mira.example", "+971501110003"]
  );
  const omar = omarResult.rows[0].id;

  async function insertGoal(input: {
    scope: "individual" | "team";
    agentId: string | null;
    createdBy: string;
    metric: string;
    unit: string | null;
    target: number;
    periodType: "daily" | "weekly" | "monthly" | "quarterly" | "custom";
    periodStart: string;
    periodEnd: string;
    status?: "active" | "completed" | "archived";
    notes?: string;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `insert into goals (scope, agent_id, created_by, metric, unit, target_value, period_type, period_start, period_end, status, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        input.scope,
        input.agentId,
        input.createdBy,
        input.metric,
        input.unit,
        input.target,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        input.status ?? "active",
        input.notes ?? null,
      ]
    );
    return result.rows[0].id;
  }

  async function insertEntry(goalId: string, entryDate: string, value: number, loggedBy: string, note?: string) {
    await pool.query(
      `insert into goal_progress_entries (goal_id, entry_date, value, note, logged_by) values ($1, $2, $3, $4, $5)`,
      [goalId, entryDate, value, note ?? null, loggedBy]
    );
  }

  // --- Farah: monthly revenue goal, on a healthy 4-day streak (including today) ---
  const farahRevenue = await insertGoal({
    scope: "individual",
    agentId: farah,
    createdBy: manager,
    metric: "revenue_aed",
    unit: "AED",
    target: 250_000,
    periodType: "monthly",
    periodStart: monthStartIso(),
    periodEnd: monthEndIso(),
    notes: "Q3 push -- focus on Downtown/Business Bay closings.",
  });
  await insertEntry(farahRevenue, isoDaysAgo(20), 45_000, farah, "Apartment deposit — Marina Heights");
  await insertEntry(farahRevenue, isoDaysAgo(12), 30_000, farah);
  await insertEntry(farahRevenue, isoDaysAgo(3), 22_500, farah, "Commission split — referral deal");
  await insertEntry(farahRevenue, isoDaysAgo(2), 15_000, farah);
  await insertEntry(farahRevenue, isoDaysAgo(1), 18_000, farah);
  await insertEntry(farahRevenue, isoDaysAgo(0), 9_500, farah, "Follow-up viewing fee credited");

  // --- Farah: daily calls-made goal, currently active streak ---
  const farahCalls = await insertGoal({
    scope: "individual",
    agentId: farah,
    createdBy: farah,
    metric: "calls_made",
    unit: "calls",
    target: 20,
    periodType: "daily",
    periodStart: isoDaysAgo(6),
    periodEnd: isoDaysFromNow(0),
  });
  for (let d = 6; d >= 0; d--) {
    await insertEntry(farahCalls, isoDaysAgo(d), 8 + ((6 - d) % 5), farah);
  }

  // --- Omar: monthly deals-closed goal, behind pace, streak broken (gap 4 days ago) ---
  const omarDeals = await insertGoal({
    scope: "individual",
    agentId: omar,
    createdBy: manager,
    metric: "deals_closed",
    unit: "deals",
    target: 6,
    periodType: "monthly",
    periodStart: monthStartIso(),
    periodEnd: monthEndIso(),
  });
  await insertEntry(omarDeals, isoDaysAgo(18), 1, omar, "Studio — JVC");
  await insertEntry(omarDeals, isoDaysAgo(9), 1, omar);
  // gap here — no entry yesterday/today, streak should read 0

  // --- Omar: weekly viewings-booked goal, completed and archived (past period) ---
  const omarViewingsDone = await insertGoal({
    scope: "individual",
    agentId: omar,
    createdBy: omar,
    metric: "viewings_booked",
    unit: "viewings",
    target: 10,
    periodType: "weekly",
    periodStart: isoDaysAgo(21),
    periodEnd: isoDaysAgo(15),
    status: "completed",
    notes: "Hit target early, closed out the week.",
  });
  await insertEntry(omarViewingsDone, isoDaysAgo(20), 4, omar);
  await insertEntry(omarViewingsDone, isoDaysAgo(18), 3, omar);
  await insertEntry(omarViewingsDone, isoDaysAgo(16), 5, omar);

  // --- Team goal: quarterly revenue, contributions from both agents + manager ---
  const teamRevenue = await insertGoal({
    scope: "team",
    agentId: null,
    createdBy: manager,
    metric: "revenue_aed",
    unit: "AED",
    target: 1_500_000,
    periodType: "quarterly",
    periodStart: isoDaysAgo(45),
    periodEnd: isoDaysFromNow(45),
    notes: "Whole-team Q3 revenue target, tracked office-wide.",
  });
  await insertEntry(teamRevenue, isoDaysAgo(20), 45_000, farah);
  await insertEntry(teamRevenue, isoDaysAgo(18), 1, omar, "placeholder — see deals_closed for detail");
  await insertEntry(teamRevenue, isoDaysAgo(10), 120_000, manager, "Villa closing — Arabian Ranches");
  await insertEntry(teamRevenue, isoDaysAgo(1), 18_000, farah);
  await insertEntry(teamRevenue, isoDaysAgo(0), 9_500, farah);

  // --- Team goal: daily new-leads-added, active habit, healthy streak ---
  const teamLeads = await insertGoal({
    scope: "team",
    agentId: null,
    createdBy: manager,
    metric: "new_leads_added",
    unit: "leads",
    target: 15,
    periodType: "daily",
    periodStart: isoDaysAgo(4),
    periodEnd: isoDaysFromNow(0),
  });
  await insertEntry(teamLeads, isoDaysAgo(4), 6, omar);
  await insertEntry(teamLeads, isoDaysAgo(4), 3, farah);
  await insertEntry(teamLeads, isoDaysAgo(3), 5, omar);
  await insertEntry(teamLeads, isoDaysAgo(2), 4, farah);
  await insertEntry(teamLeads, isoDaysAgo(1), 7, omar);
  await insertEntry(teamLeads, isoDaysAgo(0), 5, farah);

  console.log("Seeded agents:", { manager, farah, omar });
  console.log(
    "Seeded goals:",
    { farahRevenue, farahCalls, omarDeals, omarViewingsDone, teamRevenue, teamLeads }
  );
  console.log("\nDev bypass agent ids (set DEV_AGENT_ID to one of these to test as that role):");
  console.log(`  manager: ${manager}`);
  console.log(`  agent (Farah): ${farah}`);
  console.log(`  agent (Omar):  ${omar}`);
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
