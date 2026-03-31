ALTER TABLE "migration_records" ADD COLUMN "scheme_expected_total_loan" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "scheme_expected_monthly_deduction" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "scheme_expected_total_interest" numeric(15, 2);