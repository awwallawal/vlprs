import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyTriggers(db: NodePgDatabase<any>): Promise<void> {
  // Reusable immutability function (audit_log now, ledger_entries in Epic 2)
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION fn_prevent_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Modifications to % are not allowed: % operation rejected',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Immutability trigger on audit_log
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
    CREATE TRIGGER trg_audit_log_immutable
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_modification();
  `);
}
