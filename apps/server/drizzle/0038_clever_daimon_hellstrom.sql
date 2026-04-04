CREATE TABLE "loan_completions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"completion_date" timestamp with time zone NOT NULL,
	"final_balance" numeric(15, 2) NOT NULL,
	"total_paid" numeric(15, 2) NOT NULL,
	"total_principal_paid" numeric(15, 2) NOT NULL,
	"total_interest_paid" numeric(15, 2) NOT NULL,
	"trigger_source" varchar(50) NOT NULL,
	"trigger_ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan_completions" ADD CONSTRAINT "loan_completions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_completions" ADD CONSTRAINT "loan_completions_trigger_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("trigger_ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_loan_completions_loan_id" ON "loan_completions" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_loan_completions_completion_date" ON "loan_completions" USING btree ("completion_date");