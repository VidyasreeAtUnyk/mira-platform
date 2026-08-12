/**
 * apps/pipeline's type surface. Per CLAUDE.md ("don't redefine types that
 * already exist there"), `Property` and `Lead` come straight from
 * @mira/shared-types -- not redefined here. `Listing` extends `Property`
 * with the columns packages/shared-db/migrations/006_... added (status,
 * listed_at, sold_at, withdrawn_at, updated_at); the row types below
 * (`Transaction`, `ListingPriceChange`, `TransactionStageHistoryRow`) map
 * onto the new tables that same migration created, which have no shared-
 * types entry yet since they're additive/pipeline-owned (see
 * PROGRESS-pipeline.md).
 */
import type { Property } from "@mira/shared-types";
import type { PipelineStage } from "./lib/stage-machine";

export const LISTING_STATUSES = ["active", "pending", "under_offer", "sold", "withdrawn", "expired"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface Listing extends Property {
  status: ListingStatus;
  listed_at: string;
  sold_at: string | null;
  withdrawn_at: string | null;
  updated_at: string;
}

export interface ListingPriceChange {
  id: string;
  property_id: string;
  old_price: number | null;
  new_price: number;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface Transaction {
  id: string;
  lead_id: string;
  property_id: string | null;
  agent_id: string | null;
  stage: PipelineStage;
  offer_price: number | null;
  contract_price: number | null;
  expected_closing_date: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionStageHistoryRow {
  id: string;
  transaction_id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  changed_by: string | null;
  note: string | null;
  changed_at: string;
}

export interface CreateTransactionInput {
  lead_id: string;
  property_id?: string;
  agent_id?: string;
  offer_price?: number;
  notes?: string;
}

export interface TransitionTransactionInput {
  to_stage: PipelineStage;
  changed_by?: string;
  note?: string;
  /** Required when transitioning into 'closed_lost'. */
  lost_reason?: string;
  /** Set/overwrite when transitioning into 'offer' or 'under_contract'. */
  offer_price?: number;
  contract_price?: number;
  expected_closing_date?: string;
}

export interface RecordPriceChangeInput {
  property_id: string;
  new_price: number;
  reason?: string;
  changed_by?: string;
}
