CREATE TYPE "public"."migration_record_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TABLE "baseline_annotations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ledger_entry_id" uuid NOT NULL,
	"annotation_type" varchar(50) NOT NULL,
	"note" text NOT NULL,
	"superseded_upload_id" uuid,
	"replacement_upload_id" uuid,
	"annotated_by" uuid NOT NULL,
	"annotated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "status" "migration_record_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "superseded_by" uuid;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "superseded_reason" text;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "superseded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "baseline_annotations" ADD CONSTRAINT "baseline_annotations_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_annotations" ADD CONSTRAINT "baseline_annotations_superseded_upload_id_migration_uploads_id_fk" FOREIGN KEY ("superseded_upload_id") REFERENCES "public"."migration_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_annotations" ADD CONSTRAINT "baseline_annotations_replacement_upload_id_migration_uploads_id_fk" FOREIGN KEY ("replacement_upload_id") REFERENCES "public"."migration_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_annotations" ADD CONSTRAINT "baseline_annotations_annotated_by_users_id_fk" FOREIGN KEY ("annotated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_baseline_annotations_ledger_entry_id" ON "baseline_annotations" USING btree ("ledger_entry_id");--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD CONSTRAINT "migration_uploads_superseded_by_migration_uploads_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."migration_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD CONSTRAINT "migration_uploads_superseded_by_user_id_users_id_fk" FOREIGN KEY ("superseded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_migration_records_status" ON "migration_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_migration_uploads_superseded_by" ON "migration_uploads" USING btree ("superseded_by");