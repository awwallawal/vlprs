ALTER TYPE "public"."observation_type" ADD VALUE 'manual_exception';--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "action_taken" varchar(50);--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "loan_id" uuid;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "flag_notes" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exceptions_loan_id" ON "exceptions" USING btree ("loan_id");