CREATE TABLE "loan_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"from_status" "loan_status" NOT NULL,
	"to_status" "loan_status" NOT NULL,
	"transitioned_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan_state_transitions" ADD CONSTRAINT "loan_state_transitions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_state_transitions" ADD CONSTRAINT "loan_state_transitions_transitioned_by_users_id_fk" FOREIGN KEY ("transitioned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loan_state_transitions_loan_id" ON "loan_state_transitions" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_loan_state_transitions_created_at" ON "loan_state_transitions" USING btree ("created_at");