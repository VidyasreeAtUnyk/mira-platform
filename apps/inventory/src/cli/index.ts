#!/usr/bin/env node
import { loadEnvFile } from "../config/env.js";
loadEnvFile();

import { readFileSync } from "node:fs";
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { getDb, ready } from "../db/client.js";
import {
  createDeveloperPartner,
  getDeveloperPartner,
  getDeveloperPartnerByName,
  listDeveloperPartners,
  createMouTerm,
  listMouTerms,
  listMousExpiringSoon,
  listMousOverdue,
  updateMouTermStatus,
  createInventoryUnit,
  listInventoryUnits,
  logIngestionAudit,
} from "../db/queries.js";
import type { Db } from "../db/types.js";
import type { DeveloperPartner, MouTerm, MouStatus, InventoryUnitStatus, DeveloperPartnerStatus } from "../domain/types.js";
import { INVENTORY_UNIT_STATUSES, DEVELOPER_PARTNER_STATUSES, MOU_STATUSES } from "../domain/types.js";
import { parseInventoryCsv } from "../ingestion/csv.js";
import { mouUrgency } from "../domain/mou.js";
import { findMatchingInventory, matchAllWarmLeads } from "../domain/matching.js";
import { MOU_EXPIRING_SOON_DAYS } from "../config/limits.js";
import { colorUrgency, formatMoney, formatDate, truncate } from "./format.js";

const program = new Command();
program.name("inventory").description("Seller/developer inventory CLI (SPEC.md module 4)");

async function db() {
  const pool = getDb();
  await ready();
  return pool;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Developer partner CLI args accept either a UUID or an exact (case-
 * insensitive) name -- a human typing `--partner Sobha` shouldn't have to
 * look up an id first. Prints an error and returns null (caller just
 * `if (partner === null) return;`s) rather than throwing, same style as
 * apps/lead-agent/src/cli/index.ts's parseId.
 */
async function resolvePartner(database: Db, ref: string): Promise<DeveloperPartner | null> {
  const partner = UUID_RE.test(ref) ? await getDeveloperPartner(database, ref) : await getDeveloperPartnerByName(database, ref);
  if (!partner) {
    console.log(chalk.red(`No developer partner matching '${ref}' (checked by id and by exact name).`));
    return null;
  }
  return partner;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

// ============================================================
// developer partners
// ============================================================

program
  .command("partner-add")
  .description("Add a new developer partner (generic -- works for Sobha, DAMAC, or any future partner)")
  .requiredOption("--name <name>", "partner name")
  .option("--contact-name <name>", "primary contact name")
  .option("--contact-email <email>", "primary contact email")
  .option("--contact-phone <phone>", "primary contact phone")
  .option("--commission-terms <text>", "freeform default commission summary")
  .option("--commission-rate <rate>", "default commission rate, e.g. 3 for 3%")
  .option("--status <status>", "active | inactive | prospective", "active")
  .option("--notes <text>", "freeform notes")
  .action(async (opts) => {
    const database = await db();
    const existing = await getDeveloperPartnerByName(database, opts.name);
    if (existing) {
      console.log(chalk.red(`A developer partner named '${opts.name}' already exists (id ${existing.id}).`));
      return;
    }
    if (!(DEVELOPER_PARTNER_STATUSES as readonly string[]).includes(opts.status)) {
      console.log(chalk.red(`Invalid status '${opts.status}'. Expected one of: ${DEVELOPER_PARTNER_STATUSES.join(", ")}`));
      return;
    }
    const partner = await createDeveloperPartner(database, {
      name: opts.name,
      contact_name: opts.contactName,
      contact_email: opts.contactEmail,
      contact_phone: opts.contactPhone,
      commission_terms: opts.commissionTerms,
      commission_rate: opts.commissionRate !== undefined ? Number(opts.commissionRate) : undefined,
      status: opts.status as DeveloperPartnerStatus,
      notes: opts.notes,
    });
    console.log(chalk.green(`Added developer partner '${partner.name}' (id ${partner.id}).`));
  });

program
  .command("partners")
  .description("List all developer partners")
  .action(async () => {
    const database = await db();
    const partners = await listDeveloperPartners(database);
    const table = new Table({ head: ["ID", "Name", "Status", "Contact", "Default Rate"] });
    for (const p of partners) {
      table.push([
        p.id,
        p.name,
        p.status,
        p.contact_name ?? chalk.dim("--"),
        p.commission_rate !== null ? `${p.commission_rate}%` : chalk.dim("--"),
      ]);
    }
    console.log(table.toString());
    if (partners.length === 0) console.log(chalk.dim("No developer partners yet -- add one with `partner-add`."));
  });

// ============================================================
// import (CSV file or --stdin paste) -- see src/ingestion/csv.ts's doc
// comment. Never logs into anything, never stores a portal credential.
// ============================================================

program
  .command("import [file]")
  .description("Import inventory units from a CSV file, or pasted CSV/TSV text via --stdin")
  .requiredOption("-p, --partner <nameOrId>", "developer partner these units belong to (name or id)")
  .option("--stdin", "read CSV/paste text from stdin instead of a file")
  .option("--source-ref <ref>", "freeform provenance note (filename, 'pasted from email 2026-08-12', etc.)")
  .action(async (file: string | undefined, opts: { partner: string; stdin?: boolean; sourceRef?: string }) => {
    if (!opts.stdin && !file) {
      console.log(chalk.red("Provide a CSV file path, or pass --stdin to read pasted text from stdin."));
      return;
    }
    if (opts.stdin && file) {
      console.log(chalk.red("Pass either a file argument or --stdin, not both."));
      return;
    }

    const database = await db();
    const partner = await resolvePartner(database, opts.partner);
    if (!partner) return;

    let text: string;
    let source: "csv" | "paste";
    let sourceRef: string | undefined;
    if (opts.stdin) {
      text = await readStdin();
      source = "paste";
      sourceRef = opts.sourceRef;
    } else {
      text = readFileSync(file as string, "utf-8");
      source = "csv";
      sourceRef = opts.sourceRef ?? file;
    }

    if (!text.trim()) {
      console.log(chalk.red("No input text -- nothing to import."));
      return;
    }

    const parsed = parseInventoryCsv(text, { developerPartnerId: partner.id, source, sourceRef });

    let inserted = 0;
    for (const row of parsed.rows) {
      await createInventoryUnit(database, row);
      inserted += 1;
    }

    const result = { totalRows: parsed.totalRows, inserted, skipped: parsed.errors.length, errors: parsed.errors };
    await logIngestionAudit(database, {
      toolName: "inventory_import",
      inputJson: { partner_id: partner.id, source, source_ref: sourceRef, total_rows: parsed.totalRows },
      outputJson: result,
      actor: "human",
    });

    console.log(
      chalk.green(`Imported ${inserted}/${parsed.totalRows} row(s) for ${partner.name}`) +
        (result.skipped > 0 ? chalk.yellow(` (${result.skipped} skipped)`) : "")
    );
    if (result.errors.length > 0) {
      const table = new Table({ head: ["Row", "Error"] });
      for (const err of result.errors) table.push([err.row, err.message]);
      console.log(table.toString());
    }
  });

// ============================================================
// inventory units
// ============================================================

program
  .command("units")
  .description("List inventory units")
  .option("-p, --partner <nameOrId>", "filter by developer partner (name or id)")
  .option("-s, --status <status>", "filter by status: available | reserved | sold | on_hold")
  .action(async (opts: { partner?: string; status?: string }) => {
    const database = await db();
    let partnerId: string | undefined;
    if (opts.partner) {
      const partner = await resolvePartner(database, opts.partner);
      if (!partner) return;
      partnerId = partner.id;
    }
    let status: InventoryUnitStatus | undefined;
    if (opts.status) {
      if (!(INVENTORY_UNIT_STATUSES as readonly string[]).includes(opts.status)) {
        console.log(chalk.red(`Invalid status '${opts.status}'. Expected one of: ${INVENTORY_UNIT_STATUSES.join(", ")}`));
        return;
      }
      status = opts.status as InventoryUnitStatus;
    }
    const units = await listInventoryUnits(database, {
      developer_partner_id: partnerId,
      status,
    });
    const table = new Table({ head: ["ID", "Project", "Unit", "Type", "Beds", "Area", "Price", "Status", "Source"] });
    for (const u of units) {
      table.push([
        u.id,
        u.project_name,
        u.unit_ref ?? chalk.dim("--"),
        u.property_type ?? chalk.dim("--"),
        u.bedrooms ?? chalk.dim("--"),
        u.area ?? chalk.dim("--"),
        formatMoney(u.price, u.currency),
        u.status,
        u.source,
      ]);
    }
    console.log(table.toString());
    console.log(chalk.dim(`${units.length} unit(s).`));
  });

// ============================================================
// MOU compliance
// ============================================================

program
  .command("mou-add")
  .description("Record an MOU term for a developer partner")
  .requiredOption("-p, --partner <nameOrId>", "developer partner (name or id)")
  .requiredOption("--start <date>", "term start date, YYYY-MM-DD")
  .requiredOption("--end <date>", "term end date, YYYY-MM-DD")
  .option("--rate <rate>", "commission rate for this term, e.g. 3 for 3%")
  .option("--commission-notes <text>", "freeform commission notes")
  .option("--exclusive", "mark this term exclusive")
  .option("--region <region>", "exclusivity region, if exclusive")
  .option("--target <text>", "freeform target description, e.g. '24 units/yr'")
  .option("--status <status>", "draft | active | expired | renewed | terminated", "active")
  .option("--notes <text>", "freeform notes")
  .action(async (opts) => {
    const database = await db();
    const partner = await resolvePartner(database, opts.partner);
    if (!partner) return;
    if (!(MOU_STATUSES as readonly string[]).includes(opts.status)) {
      console.log(chalk.red(`Invalid status '${opts.status}'. Expected one of: ${MOU_STATUSES.join(", ")}`));
      return;
    }
    const term = await createMouTerm(database, {
      developer_partner_id: partner.id,
      term_start: opts.start,
      term_end: opts.end,
      commission_rate: opts.rate !== undefined ? Number(opts.rate) : undefined,
      commission_notes: opts.commissionNotes,
      exclusivity: Boolean(opts.exclusive),
      exclusivity_region: opts.region,
      target_description: opts.target,
      status: opts.status as MouStatus,
      notes: opts.notes,
    });
    console.log(chalk.green(`Added MOU term ${term.id} for ${partner.name} (${term.term_start} -> ${term.term_end}).`));
  });

program
  .command("mou-list")
  .description("List MOU terms, optionally filtered by developer partner")
  .option("-p, --partner <nameOrId>", "filter by developer partner (name or id)")
  .action(async (opts: { partner?: string }) => {
    const database = await db();
    let partnerId: string | undefined;
    if (opts.partner) {
      const partner = await resolvePartner(database, opts.partner);
      if (!partner) return;
      partnerId = partner.id;
    }
    const terms = await listMouTerms(database, partnerId);
    await printMouTable(database, terms);
  });

program
  .command("mou-expiring")
  .description("Show MOU terms expiring soon -- the compliance 'upcoming renewals' view (SPEC.md module 4)")
  .option("-d, --days <n>", "look-ahead window in days", String(MOU_EXPIRING_SOON_DAYS))
  .action(async (opts: { days: string }) => {
    const database = await db();
    const days = Number(opts.days);
    if (!Number.isInteger(days) || days < 0) {
      console.log(chalk.red(`Invalid --days value: '${opts.days}'.`));
      return;
    }
    const terms = await listMousExpiringSoon(database, days);
    console.log(chalk.bold(`MOU terms expiring within ${days} days:`));
    await printMouTable(database, terms);
    if (terms.length === 0) console.log(chalk.dim("None -- nothing expiring in this window."));
  });

program
  .command("mou-overdue")
  .description("Show MOU terms already past term_end but not yet renewed/terminated -- a compliance gap")
  .action(async () => {
    const database = await db();
    const terms = await listMousOverdue(database);
    console.log(chalk.bold("Overdue MOU terms (past end date, still draft/active):"));
    await printMouTable(database, terms);
    if (terms.length === 0) console.log(chalk.dim("None overdue."));
  });

program
  .command("mou-status <mouId> <status>")
  .description("Update an MOU term's status: draft | active | expired | renewed | terminated")
  .action(async (mouId: string, status: string) => {
    const database = await db();
    const validStatuses: MouStatus[] = ["draft", "active", "expired", "renewed", "terminated"];
    if (!validStatuses.includes(status as MouStatus)) {
      console.log(chalk.red(`Invalid status '${status}'. Expected one of: ${validStatuses.join(", ")}`));
      return;
    }
    const updated = await updateMouTermStatus(database, mouId, status as MouStatus);
    if (!updated) {
      console.log(chalk.red(`No MOU term with id ${mouId}.`));
      return;
    }
    console.log(chalk.green(`MOU term ${mouId} status set to '${status}'.`));
  });

async function printMouTable(database: Db, terms: MouTerm[]): Promise<void> {
  const table = new Table({ head: ["ID", "Partner", "Start", "End", "Rate", "Exclusive", "Status", "Urgency"] });
  for (const t of terms) {
    const partner = await getDeveloperPartner(database, t.developer_partner_id);
    table.push([
      t.id,
      partner?.name ?? t.developer_partner_id,
      formatDate(t.term_start),
      formatDate(t.term_end),
      t.commission_rate !== null ? `${t.commission_rate}%` : chalk.dim("--"),
      t.exclusivity ? `yes${t.exclusivity_region ? ` (${t.exclusivity_region})` : ""}` : "no",
      t.status,
      colorUrgency(mouUrgency(t)),
    ]);
  }
  console.log(table.toString());
}

// ============================================================
// buyer-demand-to-inventory matching
// ============================================================

program
  .command("match <leadId>")
  .description("Match one lead against available inventory")
  .action(async (leadId: string) => {
    if (!UUID_RE.test(leadId)) {
      console.log(chalk.red(`Invalid lead id: '${leadId}'. Expected a UUID.`));
      return;
    }
    const database = await db();
    const result = await findMatchingInventory(database, leadId);
    if (result.status === "not_found") {
      console.log(chalk.red(`No lead with id ${leadId}.`));
      return;
    }
    if (result.status === "insufficient_profile") {
      console.log(chalk.yellow(`Lead ${leadId} has no budget, location, or property-type signal on file -- refusing to guess.`));
      return;
    }
    console.log(chalk.bold(`Matches for ${result.lead.name} (${result.matches.length}):`));
    printUnitsTable(result.matches);
  });

program
  .command("match-all")
  .description("Cross-reference every warm lead against available inventory and surface matches")
  .action(async () => {
    const database = await db();
    const results = await matchAllWarmLeads(database);
    if (results.length === 0) {
      console.log(chalk.dim("No warm leads currently match any available inventory."));
      return;
    }
    for (const { lead, matches } of results) {
      console.log(chalk.bold(`\n${lead.name} (${matches.length} match(es)):`));
      printUnitsTable(matches);
    }
  });

function printUnitsTable(units: Array<{ id: string; project_name: string; unit_ref: string | null; property_type: string | null; area: string | null; price: number | null; currency: string; bedrooms: string | null }>): void {
  const table = new Table({ head: ["ID", "Project", "Unit", "Type", "Beds", "Area", "Price"] });
  for (const u of units) {
    table.push([
      u.id,
      truncate(u.project_name, 30),
      u.unit_ref ?? chalk.dim("--"),
      u.property_type ?? chalk.dim("--"),
      u.bedrooms ?? chalk.dim("--"),
      u.area ?? chalk.dim("--"),
      formatMoney(u.price, u.currency),
    ]);
  }
  console.log(table.toString());
}

program.parseAsync(process.argv);
