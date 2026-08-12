import type { QueryResult, QueryResultRow } from "pg";

/**
 * Structural type satisfied by pg's Pool, PoolClient, and Client alike --
 * same pattern as apps/lead-agent/src/db/types.ts. Every query function in
 * this app takes a Db rather than a concrete pg type so tests can pass the
 * shared test pool while production code passes the real Pool.
 */
export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}
