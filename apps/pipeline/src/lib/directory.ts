import type { Pool } from "pg";

export interface LeadOption {
  id: string;
  name: string;
  phone: string;
  stage: string;
}

export interface AgentOption {
  id: string;
  name: string;
}

/**
 * Leads eligible to start a new transaction against -- excludes lost/
 * canceled leads (dead ends, per @mira/shared-types' `leads.stage`), but
 * not `won` -- a lead can rarely start a second transaction on a different
 * property after an earlier deal closes (see stage-machine.ts's header).
 */
export async function listLeadsForNewTransaction(db: Pool): Promise<LeadOption[]> {
  const result = await db.query<LeadOption>(
    `select id, name, phone, stage from leads where stage not in ('lost', 'canceled') order by name asc`,
  );
  return result.rows;
}

export async function listAgentsForAssignment(db: Pool): Promise<AgentOption[]> {
  const result = await db.query<AgentOption>(`select id, name from agents order by name asc`);
  return result.rows;
}
