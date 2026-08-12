import type { QueryResult, QueryResultRow } from "pg";

/**
 * Structural type satisfied by pg's Pool, PoolClient, and Client alike --
 * every query function in this app takes a Db rather than a concrete pg
 * type so tests can pass a single transaction-scoped PoolClient (see
 * tests/testHelpers.ts) while production code passes the Pool.
 */
export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}
