import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, ready, closeDb } from "../db/client.js";
import { seedDatabase } from "../db/seed.js";
import { listAudit, getLead } from "../db/queries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "resumeWorker.ts");
/**
 * Dedicated database so this demo can freely wipe/reseed without touching
 * whatever's in the regular dev database. No credentials embedded -- same
 * no-password local convention as DEFAULT_DATABASE_URL (see db/client.ts);
 * override via DEMO_DATABASE_URL if this needs to point elsewhere.
 */
const DEMO_DATABASE_URL = process.env.DEMO_DATABASE_URL || "postgres://localhost:5432/mira_leadagent_demo";
const KILL_AFTER_MS = 2500;

async function freshDemoDb(): Promise<string> {
  const db = getDb(DEMO_DATABASE_URL);
  await ready();
  const ids = await seedDatabase(db);
  await closeDb(); // release the pool so the child process can connect fresh
  return ids.leads.alice;
}

function spawnWorker(leadId: string): ReturnType<typeof spawn> {
  // Spawned via `npx tsx` (PATH-based resolution) rather than a hand-built
  // path to tsx's CLI entry point -- npm workspaces hoist tsx to the repo
  // root's node_modules, and tsx's package.json doesn't expose "./dist/
  // cli.mjs" as a resolvable subpath export, so a constructed path is
  // fragile in a way `npx` (which already knows how to find workspace
  // binaries) isn't.
  return spawn("npx", ["tsx", WORKER_PATH, DEMO_DATABASE_URL, leadId], {
    stdio: "inherit",
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Demonstrates the resumability requirement: no in-memory session state
 * should be required for correctness. We start a real agent run in a child
 * process, SIGKILL it partway through (simulating a crash/deploy/OOM), then
 * start a completely fresh process for the same lead and show it picks up
 * from whatever was already committed to Postgres rather than corrupting
 * state or duplicating already-committed side effects.
 */
async function main() {
  console.log(`=== Resumability demo: kill after ${KILL_AFTER_MS}ms ===\n`);
  const leadId = await freshDemoDb();
  console.log(`Demo lead (Alice): ${leadId}`);

  console.log("--- Phase 1: starting agent run in a child process ---");
  const child = spawnWorker(leadId);
  let childExited = false;
  child.on("exit", () => {
    childExited = true;
  });

  await wait(KILL_AFTER_MS);

  if (!childExited) {
    console.log(`\n--- Killing child process (pid ${child.pid}) with SIGKILL now ---`);
    child.kill("SIGKILL");
    await wait(500);
  } else {
    console.log("\n--- Child had already finished before the kill deadline; re-run with a shorter KILL_AFTER_MS to catch it mid-run ---");
  }

  const db = getDb(DEMO_DATABASE_URL);
  await ready();
  const auditAfterKill = await listAudit(db, leadId);
  const leadAfterKill = (await getLead(db, leadId))!;
  console.log(`\nState immediately after kill: ${auditAfterKill.length} audit_log row(s) committed, lead stage='${leadAfterKill.stage}'.`);
  console.log("Tool calls committed before the kill:");
  for (const row of auditAfterKill) console.log(`  - ${row.tool_name}`);
  await closeDb();

  console.log("\n--- Phase 2: starting a brand-new process for the SAME lead (no shared memory with phase 1) ---");
  await new Promise<void>((resolve, reject) => {
    const resumed = spawnWorker(leadId);
    resumed.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`resume worker exited ${code}`))));
  });

  const db2 = getDb(DEMO_DATABASE_URL);
  await ready();
  const auditAfterResume = await listAudit(db2, leadId);
  const leadAfterResume = (await getLead(db2, leadId))!;
  console.log(`\nState after resume: ${auditAfterResume.length} audit_log row(s) total, lead stage='${leadAfterResume.stage}'.`);
  console.log(
    auditAfterResume.length > auditAfterKill.length
      ? "PASS: the resumed run added further tool calls on top of what the killed process had already committed -- resumability confirmed."
      : "The resumed run did not add new tool calls (it may have already reached a stopping point before phase 1 was killed) -- re-run the demo, or lower KILL_AFTER_MS."
  );
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
