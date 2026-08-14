import { z } from "zod";

/**
 * Postgres's `uuid` column type accepts any 32-hex-digit-with-dashes
 * string -- it does NOT enforce the RFC4122 version/variant nibbles the
 * way zod's built-in `.uuid()` does. Several real seeded leads/agents use
 * human-readable fake ids (e.g. "10000000-0000-0000-0000-000000000008")
 * that are perfectly valid Postgres uuids but fail zod's stricter check,
 * which made every API route using `.uuid()` silently reject a real
 * subset of seeded data with "Invalid UUID" (found creating a transaction
 * against one of those leads through the UI -- see the new-transaction
 * form's first live test). Use this everywhere a uuid column value is
 * validated instead of `z.string().uuid()`.
 */
export const pgUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");
