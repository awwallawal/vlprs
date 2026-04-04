ALTER TABLE "migration_records" ADD COLUMN "correction_reason" text;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "flagged_for_review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "review_window_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "review_window_extensions" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_migration_records_review" ON "migration_records" USING btree ("upload_id","flagged_for_review_at");