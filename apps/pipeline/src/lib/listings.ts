import type { Pool } from "pg";
import type { Listing, ListingPriceChange, ListingStatus, RecordPriceChangeInput } from "../types";

/**
 * Days on market: whole days between when a listing went live and either
 * "now" (still active/pending/under_offer) or the day it stopped being on
 * the market (sold_at/withdrawn_at), whichever applies. A generated SQL
 * column was considered and rejected -- "now" needs to be evaluated at read
 * time for still-active listings, which a plain `generated always as`
 * column can't do (it's only recomputed on write), and Postgres versions
 * across dev/prod aren't guaranteed to support the fancier options. Kept as
 * a pure function instead, computed in application code at read time.
 */
export function calculateDaysOnMarket(listing: Pick<Listing, "listed_at" | "sold_at" | "withdrawn_at" | "status">): number {
  const listedAt = new Date(listing.listed_at).getTime();
  const endedAt = listing.sold_at ?? listing.withdrawn_at;
  const endTime = endedAt ? new Date(endedAt).getTime() : Date.now();
  const ms = Math.max(0, endTime - listedAt);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export interface ListingWithDom extends Listing {
  days_on_market: number;
}

function withDom(row: Listing): ListingWithDom {
  return { ...row, days_on_market: calculateDaysOnMarket(row) };
}

export async function listListings(db: Pool, opts: { status?: ListingStatus } = {}): Promise<ListingWithDom[]> {
  const result = opts.status
    ? await db.query<Listing>("SELECT * FROM properties WHERE status = $1 ORDER BY listed_at DESC", [opts.status])
    : await db.query<Listing>("SELECT * FROM properties ORDER BY listed_at DESC");
  return result.rows.map(withDom);
}

export async function getListing(db: Pool, propertyId: string): Promise<ListingWithDom | null> {
  const result = await db.query<Listing>("SELECT * FROM properties WHERE id = $1", [propertyId]);
  return result.rows[0] ? withDom(result.rows[0]) : null;
}

export async function getPriceChanges(db: Pool, propertyId: string): Promise<ListingPriceChange[]> {
  const result = await db.query<ListingPriceChange>(
    "SELECT * FROM listing_price_changes WHERE property_id = $1 ORDER BY changed_at ASC",
    [propertyId],
  );
  return result.rows;
}

/**
 * The only legal statuses to move a listing OUT of "on the market" into.
 * Mirrors `properties_status_check` in the migration -- kept here too so
 * application code fails fast with a clear message instead of surfacing a
 * raw Postgres constraint-violation error to the UI.
 */
const TERMINAL_LISTING_STATUSES: ListingStatus[] = ["sold", "withdrawn", "expired"];

export async function updateListingStatus(
  db: Pool,
  propertyId: string,
  status: ListingStatus,
): Promise<ListingWithDom> {
  const now = new Date().toISOString();
  const setSold = status === "sold";
  const setWithdrawn = status === "withdrawn" || status === "expired";
  const result = await db.query<Listing>(
    `UPDATE properties
     SET status = $2,
         sold_at = CASE WHEN $3 THEN COALESCE(sold_at, $4::timestamptz) ELSE sold_at END,
         withdrawn_at = CASE WHEN $5 THEN COALESCE(withdrawn_at, $4::timestamptz) ELSE withdrawn_at END
     WHERE id = $1
     RETURNING *`,
    [propertyId, status, setSold, now, setWithdrawn],
  );
  if (!result.rows[0]) {
    throw new Error(`No listing found with id ${propertyId}`);
  }
  return withDom(result.rows[0]);
}

export function isTerminalListingStatus(status: ListingStatus): boolean {
  return TERMINAL_LISTING_STATUSES.includes(status);
}

/**
 * Records a price change AND updates properties.price to match, atomically
 * (one transaction) -- these two facts (current price, price-change log)
 * must never drift apart. `old_price` is read from the current row inside
 * the transaction rather than trusted from the caller, so concurrent price
 * changes can't corrupt the log.
 */
export async function recordPriceChange(db: Pool, input: RecordPriceChangeInput): Promise<ListingPriceChange> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ price: number }>("SELECT price FROM properties WHERE id = $1 FOR UPDATE", [
      input.property_id,
    ]);
    if (!current.rows[0]) {
      throw new Error(`No listing found with id ${input.property_id}`);
    }
    const oldPrice = current.rows[0].price;
    const inserted = await client.query<ListingPriceChange>(
      `INSERT INTO listing_price_changes (property_id, old_price, new_price, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.property_id, oldPrice, input.new_price, input.reason ?? null, input.changed_by ?? null],
    );
    await client.query("UPDATE properties SET price = $2 WHERE id = $1", [input.property_id, input.new_price]);
    await client.query("COMMIT");
    return inserted.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
