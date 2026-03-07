ALTER TYPE "public"."migration_upload_status" ADD VALUE 'reconciled' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "loan_id" uuid;--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "is_baseline_created" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;