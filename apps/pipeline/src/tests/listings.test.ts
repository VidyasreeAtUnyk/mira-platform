import type { Test } from "./testHelpers";
import { assertTrue, assertEqual, createTestDb, seedMinimalAgent, seedMinimalProperty } from "./testHelpers";
import { calculateDaysOnMarket, recordPriceChange, updateListingStatus, getListing, getPriceChanges } from "../lib/listings";

export const listingsTests: Test[] = [
  {
    name: "calculateDaysOnMarket: an active listing counts from listed_at to now",
    run: () => {
      const listedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const dom = calculateDaysOnMarket({ listed_at: listedAt, sold_at: null, withdrawn_at: null, status: "active" });
      assertTrue(dom >= 9 && dom <= 10, `expected ~10 days on market, got ${dom}`);
    },
  },
  {
    name: "calculateDaysOnMarket: a sold listing counts from listed_at to sold_at, not to now",
    run: () => {
      const listedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const soldAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const dom = calculateDaysOnMarket({ listed_at: listedAt, sold_at: soldAt, withdrawn_at: null, status: "sold" });
      assertEqual(dom, 20, "days on market should stop counting at sold_at");
    },
  },
  {
    name: "recordPriceChange: reads old_price from the current row and updates properties.price atomically",
    run: async () => {
      const db = await createTestDb();
      const agentId = await seedMinimalAgent(db);
      const propertyId = await seedMinimalProperty(db, 1000000);
      const change = await recordPriceChange(db, { property_id: propertyId, new_price: 950000, reason: "Price cut", changed_by: agentId });
      assertEqual(change.old_price, 1000000, "old_price should be read from the row, not trusted from the caller");
      assertEqual(change.new_price, 950000, "new_price should match the requested value");
      const listing = await getListing(db, propertyId);
      assertTrue(listing !== null, "listing should still exist");
      assertEqual(listing!.price, 950000, "properties.price should be updated to match the new price");
    },
  },
  {
    name: "recordPriceChange: a second change reads the updated price as its old_price (no drift)",
    run: async () => {
      const db = await createTestDb();
      const propertyId = await seedMinimalProperty(db, 1000000);
      await recordPriceChange(db, { property_id: propertyId, new_price: 950000 });
      const second = await recordPriceChange(db, { property_id: propertyId, new_price: 900000 });
      assertEqual(second.old_price, 950000, "second change's old_price should be the first change's new_price");
      const history = await getPriceChanges(db, propertyId);
      assertEqual(history.length, 2, "both price changes should be logged");
    },
  },
  {
    name: "updateListingStatus: moving to 'sold' sets sold_at once and does not overwrite it on repeat calls",
    run: async () => {
      const db = await createTestDb();
      const propertyId = await seedMinimalProperty(db);
      const first = await updateListingStatus(db, propertyId, "sold");
      assertTrue(first.sold_at !== null, "sold_at should be set");
      // pg returns timestamptz columns as Date objects at runtime (see
      // testHelpers.ts's note on the NUMERIC parser for the analogous
      // string-vs-number gotcha) -- compare by value, not by reference/type,
      // so this assertion is robust to either representation.
      const firstSoldAtMs = new Date(first.sold_at as unknown as string).getTime();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await updateListingStatus(db, propertyId, "sold");
      const secondSoldAtMs = new Date(second.sold_at as unknown as string).getTime();
      assertEqual(secondSoldAtMs, firstSoldAtMs, "sold_at should not change on a repeat 'sold' update");
    },
  },
];
