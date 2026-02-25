CREATE TYPE "public"."entry_type" AS ENUM('PAYROLL', 'ADJUSTMENT', 'MIGRATION_BASELINE', 'WRITE_OFF');--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"mda_id" uuid NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"principal_component" numeric(15, 2) NOT NULL,
	"interest_component" numeric(15, 2) NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"payroll_batch_reference" varchar(100),
	"source" varchar(255),
	"posted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_loans_loan_reference";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ledger_entries_loan_id" ON "ledger_entries" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_entries_mda_id" ON "ledger_entries" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_entries_staff_id" ON "ledger_entries" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_entries_created_at" ON "ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ledger_entries_period" ON "ledger_entries" USING btree ("period_year","period_month");