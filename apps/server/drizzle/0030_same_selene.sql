CREATE TABLE "loan_annotations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_event_flag_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"submission_row_id" uuid,
	"original_event_flag" "event_flag_type" NOT NULL,
	"new_event_flag" "event_flag_type" NOT NULL,
	"correction_reason" text NOT NULL,
	"corrected_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan_annotations" ADD CONSTRAINT "loan_annotations_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_annotations" ADD CONSTRAINT "loan_annotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_event_flag_corrections" ADD CONSTRAINT "loan_event_flag_corrections_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_event_flag_corrections" ADD CONSTRAINT "loan_event_flag_corrections_submission_row_id_submission_rows_id_fk" FOREIGN KEY ("submission_row_id") REFERENCES "public"."submission_rows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_event_flag_corrections" ADD CONSTRAINT "loan_event_flag_corrections_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loan_annotations_loan_id" ON "loan_annotations" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_loan_annotations_created_at" ON "loan_annotations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_loan_event_flag_corrections_loan_id" ON "loan_event_flag_corrections" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_loan_event_flag_corrections_created_at" ON "loan_event_flag_corrections" USING btree ("created_at");