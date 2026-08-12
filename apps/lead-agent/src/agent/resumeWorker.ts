import { loadEnvFile } from "../config/env.js";
loadEnvFile();

import { getDb, ready } from "../db/client.js";
import { runAgentForLead } from "./loop.js";

/**
 * Minimal standalone entry point: connect to the given Postgres database and
 * run one agent turn-loop for one lead, then exit. Used both directly
 * (`npm run process` style single-lead runs) and as the child process
 * spawned by demoResume.ts, which kills it mid-run to prove resumability.
 */
async function main() {
  const databaseUrl = process.argv[2];
  const leadId = process.argv[3];
  if (!databaseUrl || !leadId) {
    console.error("Usage: resumeWorker.ts <databaseUrl> <leadId>");
    process.exit(1);
  }
  const db = getDb(databaseUrl);
  await ready();
  const result = await runAgentForLead(db, leadId);
  console.log(`WORKER_RESULT ${JSON.stringify(result)}`);
}

main().catch((e) => {
  console.error("WORKER_ERROR", e);
  process.exit(1);
});
