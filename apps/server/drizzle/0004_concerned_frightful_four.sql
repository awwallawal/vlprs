CREATE TABLE "temporal_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"old_value" date,
	"new_value" date NOT NULL,
	"old_retirement_date" date,
	"new_retirement_date" date,
	"corrected_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "date_of_first_appointment" date;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "computed_retirement_date" date;--> statement-breakpoint
ALTER TABLE "temporal_corrections" ADD CONSTRAINT "temporal_corrections_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporal_corrections" ADD CONSTRAINT "temporal_corrections_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_temporal_corrections_loan_id" ON "temporal_corrections" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_temporal_corrections_created_at" ON "temporal_corrections" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_loans_computed_retirement_date" ON "loans" USING btree ("computed_retirement_date");