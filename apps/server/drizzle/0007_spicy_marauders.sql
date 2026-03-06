CREATE TYPE "public"."migration_upload_status" AS ENUM('uploaded', 'mapped', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "migration_extra_fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"field_value" text,
	"source_header" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "migration_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"upload_id" uuid NOT NULL,
	"mda_id" uuid NOT NULL,
	"sheet_name" text NOT NULL,
	"row_number" integer NOT NULL,
	"era" integer NOT NULL,
	"period_year" integer,
	"period_month" integer,
	"staff_name" text NOT NULL,
	"principal" numeric(15, 2),
	"interest_total" numeric(15, 2),
	"total_loan" numeric(15, 2),
	"monthly_deduction" numeric(15, 2),
	"monthly_interest" numeric(15, 2),
	"monthly_principal" numeric(15, 2),
	"total_interest_paid" numeric(15, 2),
	"total_outstanding_interest" numeric(15, 2),
	"total_loan_paid" numeric(15, 2),
	"outstanding_balance" numeric(15, 2),
	"installment_count" integer,
	"installments_paid" integer,
	"installments_outstanding" integer,
	"employee_no" text,
	"ref_id" text,
	"commencement_date" text,
	"start_date" text,
	"end_date" text,
	"station" text,
	"remarks" text,
	"date_of_birth" text,
	"date_of_first_appointment" text,
	"source_file" text NOT NULL,
	"source_sheet" text NOT NULL,
	"source_row" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "migration_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mda_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"sheet_count" integer DEFAULT 0 NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"status" "migration_upload_status" DEFAULT 'uploaded' NOT NULL,
	"era_detected" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "migration_extra_fields" ADD CONSTRAINT "migration_extra_fields_record_id_migration_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."migration_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_upload_id_migration_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."migration_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD CONSTRAINT "migration_uploads_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD CONSTRAINT "migration_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_migration_extra_fields_record_id" ON "migration_extra_fields" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "idx_migration_records_upload_id" ON "migration_records" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "idx_migration_records_mda_id" ON "migration_records" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_migration_records_staff_name" ON "migration_records" USING btree ("staff_name");--> statement-breakpoint
CREATE INDEX "idx_migration_records_created_at" ON "migration_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_migration_uploads_mda_id" ON "migration_uploads" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_migration_uploads_uploaded_by" ON "migration_uploads" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_migration_uploads_status" ON "migration_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_migration_uploads_created_at" ON "migration_uploads" USING btree ("created_at");