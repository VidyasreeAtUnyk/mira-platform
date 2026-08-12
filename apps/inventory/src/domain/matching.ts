import type { Db } from "../db/types.js";
import { getMatchableLead, listWarmLeads, listAvailableInventoryUnits, type MatchableLead } from "../db/queries.js";
import type { InventoryUnit } from "./types.js";

export type MatchResult =
  | { status: "insufficient_profile" }
  | { status: "not_found" }
  | { status: "ok"; lead: MatchableLead; matches: InventoryUnit[] };

/**
 * Buyer-demand-to-inventory matching (SPEC.md module 4). Same shape and
 * philosophy as apps/lead-agent/src/tools/findMatchingProperties.ts's
 * findMatchingProperties -- plain structured filtering over budget/location/
 * property type/bedrooms, deliberately not RAG/embeddings -- but reads from
 * this module's `inventory_units` (developer partner feed) instead of
 * apps/lead-agent's own `properties` table. If the lead has none of
 * budget_max, a location signal (location_pref or preferred_areas), or a
 * property-type signal (property_interest or property_type) on file, refuse
 * to guess and return insufficient_profile, same rule as the original.
 */
export async function findMatchingInventory(db: Db, leadId: string): Promise<MatchResult> {
  const lead = await getMatchableLead(db, leadId);
  if (!lead) return { status: "not_found" };

  const hasLocationSignal = Boolean(lead.location_pref) || Boolean(lead.preferred_areas?.length);
  const hasTypeSignal = Boolean(lead.property_interest) || Boolean(lead.property_type);

  if (!lead.budget_max && !hasLocationSignal && !hasTypeSignal) {
    return { status: "insufficient_profile" };
  }

  const units = await listAvailableInventoryUnits(db);
  const matches = filterAndRankInventory(lead, units);
  return { status: "ok", lead, matches };
}

/** Cross-references every warm lead against available inventory -- the "surface matches" view module 4 calls for. */
export async function matchAllWarmLeads(db: Db): Promise<Array<{ lead: MatchableLead; matches: InventoryUnit[] }>> {
  const [leads, units] = await Promise.all([listWarmLeads(db), listAvailableInventoryUnits(db)]);
  const results: Array<{ lead: MatchableLead; matches: InventoryUnit[] }> = [];

  for (const lead of leads) {
    const hasLocationSignal = Boolean(lead.location_pref) || Boolean(lead.preferred_areas?.length);
    const hasTypeSignal = Boolean(lead.property_interest) || Boolean(lead.property_type);
    if (!lead.budget_max && !hasLocationSignal && !hasTypeSignal) continue; // same insufficient_profile guard, silently skipped in the bulk view

    const matches = filterAndRankInventory(lead, units);
    if (matches.length > 0) results.push({ lead, matches });
  }

  return results;
}

function filterAndRankInventory(lead: MatchableLead, units: InventoryUnit[]): InventoryUnit[] {
  const typeSignal = (lead.property_interest ?? lead.property_type ?? "").toLowerCase();
  const areaSignals = [lead.location_pref, ...(lead.preferred_areas ?? [])]
    .filter((a): a is string => Boolean(a))
    .map((a) => a.toLowerCase());

  const filtered = units.filter((u) => {
    // 10% headroom above budget_max, same tolerance as findMatchingProperties
    // (a unit slightly over budget is still worth surfacing, further over is not).
    if (lead.budget_max && u.price !== null && u.price > lead.budget_max * 1.1) return false;
    if (lead.budget_min && u.price !== null && u.price < lead.budget_min * 0.9) return false;

    if (areaSignals.length > 0) {
      const area = (u.area ?? "").toLowerCase();
      const matchesArea = areaSignals.some((signal) => area.includes(signal) || signal.includes(area));
      if (!matchesArea && area) return false;
      if (!area) return false; // no area on the unit at all -- can't confirm a location match, don't guess
    }

    if (typeSignal) {
      const unitType = (u.property_type ?? "").toLowerCase();
      if (unitType && !unitType.includes(typeSignal) && !typeSignal.includes(unitType)) return false;
    }

    if (lead.bedrooms) {
      const wantsBedrooms = lead.bedrooms.toLowerCase();
      const unitBedrooms = (u.bedrooms ?? "").toLowerCase();
      if (unitBedrooms && unitBedrooms !== wantsBedrooms) return false;
    }

    return true;
  });

  // Closer to budget_max (without exceeding it) ranks first; over-budget
  // matches (within the 10% headroom) sort after every in-budget one.
  return [...filtered].sort((a, b) => {
    const aOver = lead.budget_max && a.price !== null && a.price > lead.budget_max ? 1 : 0;
    const bOver = lead.budget_max && b.price !== null && b.price > lead.budget_max ? 1 : 0;
    if (aOver !== bOver) return aOver - bOver;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return b.price - a.price;
  });
}
