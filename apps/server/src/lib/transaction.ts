import { db } from '../db';

/**
 * Transaction handle type — enables composable transactions.
 * When a function accepts `existingTx?: TxHandle`, callers can
 * either let the function open its own transaction or inject a
 * pre-existing one to participate in a larger atomic operation.
 */
export type TxHandle = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Execute `fn` within a database transaction.
 *
 * - If `existingTx` is provided, runs `fn(existingTx)` directly (composable — no nested tx).
 * - If omitted, wraps `fn` in a new `db.transaction()`.
 *
 * Error handling: Drizzle auto-rolls back on thrown errors — no manual rollback needed.
 *
 * @example
 * // Standalone usage
 * const result = await withTransaction(async (tx) => {
 *   await tx.insert(table).values(data);
 *   return tx.select().from(table);
 * });
 *
 * // Composable usage — participate in caller's transaction
 * async function innerOp(existingTx?: TxHandle) {
 *   return withTransaction(async (tx) => {
 *     await tx.insert(table).values(data);
 *   }, existingTx);
 * }
 */
export async function withTransaction<T>(
  fn: (tx: TxHandle) => Promise<T>,
  existingTx?: TxHandle,
): Promise<T> {
  if (existingTx) return fn(existingTx);
  return db.transaction(fn);
}
