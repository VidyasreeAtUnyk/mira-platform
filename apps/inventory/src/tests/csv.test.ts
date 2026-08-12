import type { Test } from "./testHelpers.js";
import { assertTrue, assertEqual } from "./testHelpers.js";
import { parseInventoryCsv } from "../ingestion/csv.js";

const PARTNER_ID = "11111111-1111-1111-1111-111111111111";

export const csvTests: Test[] = [
  {
    name: "parseInventoryCsv: loose/case-insensitive header matching maps real-world export headers",
    run: () => {
      const csv = ["Project Name,Unit No,Type,Beds,Community,List Price", "Sobha One,S1-101,Apartment,2,Sobha Hartland,1500000"].join(
        "\n"
      );
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.errors.length, 0, "no parse errors expected");
      assertEqual(result.rows.length, 1, "one row expected");
      const row = result.rows[0];
      assertEqual(row.project_name, "Sobha One", "project_name mapped from 'Project Name'");
      assertEqual(row.unit_ref, "S1-101", "unit_ref mapped from 'Unit No'");
      assertEqual(row.property_type, "Apartment", "property_type mapped from 'Type'");
      assertEqual(row.area, "Sobha Hartland", "area mapped from 'Community'");
      assertEqual(row.price, 1500000, "price mapped from 'List Price'");
    },
  },
  {
    name: "parseInventoryCsv: missing required project_name produces a row error, not a thrown exception",
    run: () => {
      const csv = ["unit,price", "U-1,100000"].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.rows.length, 0, "no valid rows");
      assertEqual(result.errors.length, 1, "exactly one row error");
      assertTrue(result.errors[0].message.includes("project_name"), "error should mention project_name");
    },
  },
  {
    name: "parseInventoryCsv: numeric fields tolerate thousands separators and an AED prefix",
    run: () => {
      const csv = ["project,price,size", 'Test Tower,"AED 2,100,000","1,200"'].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.errors.length, 0, "no parse errors expected");
      assertEqual(result.rows[0].price, 2100000, "price should strip commas and AED prefix");
      assertEqual(result.rows[0].size_sqft, 1200, "size_sqft should strip commas");
    },
  },
  {
    name: "parseInventoryCsv: a non-numeric value in a numeric column is a row error, not silently coerced",
    run: () => {
      const csv = ["project,price", "Test Tower,not-a-number"].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.rows.length, 0, "row should be rejected");
      assertEqual(result.errors.length, 1, "one row error expected");
    },
  },
  {
    name: "parseInventoryCsv: blank optional cells are left undefined, not empty strings",
    run: () => {
      const csv = ["project,unit,price", "Test Tower,,"].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.rows.length, 1, "one row expected");
      assertEqual(result.rows[0].unit_ref, undefined, "blank unit cell should be undefined");
      assertEqual(result.rows[0].price, undefined, "blank price cell should be undefined");
    },
  },
  {
    name: "parseInventoryCsv: an unrecognized status value falls back to undefined rather than guessing",
    run: () => {
      const csv = ["project,status", "Test Tower,Coming Soon"].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.rows[0].status, undefined, "unrecognized status should not be forced onto the enum");
    },
  },
  {
    name: "parseInventoryCsv: a recognized status value (with spaces normalized) is accepted",
    run: () => {
      const csv = ["project,status", "Test Tower,On Hold"].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "csv" });
      assertEqual(result.rows[0].status, "on_hold", "'On Hold' should normalize to 'on_hold'");
    },
  },
  {
    name: "parseInventoryCsv: unparseable CSV text returns a single row-0 error instead of throwing",
    run: () => {
      const result = parseInventoryCsv('"unterminated quote,price\n"Test,100', {
        developerPartnerId: PARTNER_ID,
        source: "csv",
      });
      assertEqual(result.rows.length, 0, "no rows on unparseable input");
      assertTrue(result.errors.length >= 1, "at least one error reported");
      assertEqual(result.errors[0].row, 0, "unparseable-input error is reported at row 0");
    },
  },
  {
    name: "parseInventoryCsv: pasted TSV-via-comma text with a raw_data snapshot preserves the original row",
    run: () => {
      const csv = ["project,unit", "Paste Tower,P-1"].join("\n");
      const result = parseInventoryCsv(csv, { developerPartnerId: PARTNER_ID, source: "paste", sourceRef: "pasted 2026-08-12" });
      assertEqual(result.rows[0].source, "paste", "source should be 'paste'");
      assertEqual(result.rows[0].source_ref, "pasted 2026-08-12", "source_ref should carry through");
      assertTrue(
        (result.rows[0].raw_data as Record<string, string>).project === "Paste Tower",
        "raw_data should retain the original row for audit purposes"
      );
    },
  },
];
