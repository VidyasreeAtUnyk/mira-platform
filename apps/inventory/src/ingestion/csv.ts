import { parse } from "csv-parse/sync";
import { z } from "zod";
import { MAX_INGESTION_ROWS } from "../config/limits.js";
import type { CreateInventoryUnitInput, InventoryUnitStatus, IngestionRowError, InventorySource } from "../domain/types.js";
import { INVENTORY_UNIT_STATUSES } from "../domain/types.js";

/**
 * Semi-manual ingestion (SPEC.md module 4 / CLAUDE.md's hard rule): this
 * parses text a human already has in hand -- a CSV file exported from a
 * developer portal, or a table pasted straight from an email/Excel/the
 * portal UI. It never logs into anything and never stores a developer
 * portal credential. `source` records which of the two this was for the
 * audit trail; both go through this exact same parser (a paste is just CSV/
 * TSV text without a file path) -- see apps/inventory/src/cli/index.ts's
 * `inventory import --stdin` path.
 *
 * Column headers are matched case-insensitively and loosely (spaces/
 * underscores interchangeable) since real-world exports/pastes are never
 * perfectly consistent. Only `project_name` is required -- everything else
 * is optional and simply left null if the column is absent or blank,
 * because vendor exports vary in what they include and we'd rather ingest a
 * partial row than reject it outright.
 */

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  project: "project_name",
  project_name: "project_name",
  projectname: "project_name",
  unit: "unit_ref",
  unit_ref: "unit_ref",
  unit_number: "unit_ref",
  unitno: "unit_ref",
  unit_no: "unit_ref",
  type: "property_type",
  property_type: "property_type",
  unit_type: "property_type",
  bedrooms: "bedrooms",
  beds: "bedrooms",
  br: "bedrooms",
  area: "area",
  location: "area",
  community: "area",
  price: "price",
  list_price: "price",
  currency: "currency",
  size: "size_sqft",
  size_sqft: "size_sqft",
  sqft: "size_sqft",
  area_sqft: "size_sqft",
  floor: "floor",
  view: "view",
  handover: "handover_date",
  handover_date: "handover_date",
  payment_plan: "payment_plan",
  paymentplan: "payment_plan",
  status: "status",
};

interface CsvRow {
  project_name?: string;
  unit_ref?: string;
  property_type?: string;
  bedrooms?: string;
  area?: string;
  price?: string;
  currency?: string;
  size_sqft?: string;
  floor?: string;
  view?: string;
  handover_date?: string;
  payment_plan?: string;
  status?: string;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const numericField = z
  .string()
  .trim()
  .transform((s) => s.replace(/[,\s]/g, "").replace(/^AED\s*/i, ""))
  .refine((s) => s === "" || !Number.isNaN(Number(s)), "not a number")
  .transform((s) => (s === "" ? undefined : Number(s)));

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? undefined : s));

const rowSchema = z.object({
  project_name: z.string().trim().min(1, "project_name is required"),
  unit_ref: optionalText.optional(),
  property_type: optionalText.optional(),
  bedrooms: optionalText.optional(),
  area: optionalText.optional(),
  price: numericField.optional(),
  currency: optionalText.optional(),
  size_sqft: numericField.optional(),
  floor: optionalText.optional(),
  view: optionalText.optional(),
  handover_date: optionalText.optional(),
  payment_plan: optionalText.optional(),
  status: optionalText.optional(),
});

export interface ParseInventoryCsvOptions {
  developerPartnerId: string;
  source: InventorySource;
  sourceRef?: string;
}

export interface ParseInventoryCsvResult {
  rows: CreateInventoryUnitInput[];
  errors: IngestionRowError[];
  totalRows: number;
}

export function parseInventoryCsv(csvText: string, options: ParseInventoryCsvOptions): ParseInventoryCsvResult {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: (headerRow: string[]) => headerRow.map((h) => normalizeHeader(h)),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (e) {
    return { rows: [], errors: [{ row: 0, message: `Could not parse as CSV: ${(e as Error).message}` }], totalRows: 0 };
  }

  if (records.length > MAX_INGESTION_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `${records.length} rows exceeds the ${MAX_INGESTION_ROWS}-row ingestion cap for a single import -- split the file.`,
        },
      ],
      totalRows: records.length,
    };
  }

  const rows: CreateInventoryUnitInput[] = [];
  const errors: IngestionRowError[] = [];

  records.forEach((record, index) => {
    const mapped: Record<string, string> = {};
    for (const [rawHeader, value] of Object.entries(record)) {
      const mappedKey = HEADER_ALIASES[rawHeader];
      if (mappedKey && value !== undefined) mapped[mappedKey] = value;
    }

    const parsed = rowSchema.safeParse(mapped);
    if (!parsed.success) {
      // Prefix each issue with its field path (zod's own message alone is
      // often just "Required" for an absent column, which -- without the
      // field name -- leaves a human staring at an ingestion error with no
      // idea which column to fix).
      const message = parsed.error.issues
        .map((i) => (i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
      errors.push({ row: index + 2, message }); // +2: header row + 1-indexing
      return;
    }

    const status = normalizeStatus(parsed.data.status);
    rows.push({
      developer_partner_id: options.developerPartnerId,
      project_name: parsed.data.project_name,
      unit_ref: parsed.data.unit_ref,
      property_type: parsed.data.property_type,
      bedrooms: parsed.data.bedrooms,
      area: parsed.data.area,
      price: parsed.data.price,
      currency: parsed.data.currency,
      size_sqft: parsed.data.size_sqft,
      floor: parsed.data.floor,
      view: parsed.data.view,
      handover_date: parsed.data.handover_date,
      payment_plan: parsed.data.payment_plan,
      status,
      source: options.source,
      source_ref: options.sourceRef,
      raw_data: record,
    });
  });

  return { rows, errors, totalRows: records.length };
}

function normalizeStatus(raw: string | undefined): InventoryUnitStatus | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (INVENTORY_UNIT_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as InventoryUnitStatus)
    : undefined; // unrecognized status text -- fall back to the table default ('available') rather than guess
}
