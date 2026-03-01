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

  // Immutability trigger on ledger_entries (Story 2.2)
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_ledger_entries_immutable ON ledger_entries;
    CREATE TRIGGER trg_ledger_entries_immutable
      BEFORE UPDATE OR DELETE ON ledger_entries
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_modification();
  `);

  // Immutability trigger on loan_state_transitions (Story 2.7)
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_loan_state_transitions_immutable ON loan_state_transitions;
    CREATE TRIGGER trg_loan_state_transitions_immutable
      BEFORE UPDATE OR DELETE ON loan_state_transitions
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_modification();
  `);

  // Immutability trigger on temporal_corrections (Story 10.1)
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_temporal_corrections_immutable ON temporal_corrections;
    CREATE TRIGGER trg_temporal_corrections_immutable
      BEFORE UPDATE OR DELETE ON temporal_corrections
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_modification();
  `);
}
