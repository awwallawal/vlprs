ALTER TYPE "public"."event_flag_type" ADD VALUE 'ABSCONDED';--> statement-breakpoint
ALTER TYPE "public"."event_flag_type" ADD VALUE 'SERVICE_EXTENSION';--> statement-breakpoint
ALTER TYPE "public"."event_flag_type" ADD VALUE 'DISMISSAL';
-- NOTE: Data migration (UPDATE submission_rows SET event_flag = 'DISMISSAL' WHERE event_flag = 'TERMINATION')
-- intentionally omitted. PostgreSQL requires ADD VALUE to be committed before the new value can be used in DML.
-- Verified 0 TERMINATION rows exist in submission_rows — this is a no-op. If future data exists,
-- run manually: UPDATE submission_rows SET event_flag = 'DISMISSAL' WHERE event_flag = 'TERMINATION';