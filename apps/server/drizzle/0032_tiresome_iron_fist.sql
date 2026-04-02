ALTER TABLE "migration_records" ADD COLUMN "corrected_outstanding_balance" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "corrected_total_loan" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "corrected_monthly_deduction" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "corrected_installment_count" integer;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "original_values_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "corrected_by" uuid;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "corrected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;