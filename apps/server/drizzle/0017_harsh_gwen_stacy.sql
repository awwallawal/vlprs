CREATE TYPE "public"."event_flag_type" AS ENUM('NONE', 'RETIREMENT', 'DEATH', 'SUSPENSION', 'TRANSFER_OUT', 'TRANSFER_IN', 'LEAVE_WITHOUT_PAY', 'REINSTATEMENT', 'TERMINATION');--> statement-breakpoint
CREATE TYPE "public"."submission_record_status" AS ENUM('processing', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "mda_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mda_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"status" "submission_record_status" DEFAULT 'processing' NOT NULL,
	"record_count" integer NOT NULL,
	"filename" varchar(500),
	"file_size_bytes" integer,
	"validation_errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mda_submissions_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "submission_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submission_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount_deducted" numeric(15, 2) NOT NULL,
	"payroll_batch_reference" varchar(100) NOT NULL,
	"mda_code" varchar(50) NOT NULL,
	"event_flag" "event_flag_type" NOT NULL,
	"event_date" date,
	"cessation_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mda_submissions" ADD CONSTRAINT "mda_submissions_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mda_submissions" ADD CONSTRAINT "mda_submissions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_rows" ADD CONSTRAINT "submission_rows_submission_id_mda_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."mda_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mda_submissions_mda_id" ON "mda_submissions" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_mda_submissions_period" ON "mda_submissions" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mda_submissions_reference" ON "mda_submissions" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "idx_submission_rows_submission_id" ON "submission_rows" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_submission_rows_staff_id" ON "submission_rows" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_submission_rows_month" ON "submission_rows" USING btree ("month");