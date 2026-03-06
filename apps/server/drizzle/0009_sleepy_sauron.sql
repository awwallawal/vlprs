CREATE TYPE "public"."variance_category" AS ENUM('clean', 'minor_variance', 'significant_variance', 'structural_error', 'anomalous');--> statement-breakpoint
ALTER TYPE "public"."migration_upload_status" ADD VALUE 'validated' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "variance_category" "variance_category";--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "variance_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "computed_rate" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "has_rate_variance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "computed_total_loan" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "computed_monthly_deduction" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "computed_outstanding_balance" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "has_multi_mda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "multi_mda_boundaries" jsonb;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "validation_summary" jsonb;--> statement-breakpoint
CREATE INDEX "idx_migration_records_variance_category" ON "migration_records" USING btree ("variance_category");--> statement-breakpoint
CREATE INDEX "idx_migration_records_has_rate_variance" ON "migration_records" USING btree ("has_rate_variance");