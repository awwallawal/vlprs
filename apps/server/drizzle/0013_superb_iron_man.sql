CREATE TYPE "public"."exception_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."exception_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."observation_status" AS ENUM('unreviewed', 'reviewed', 'resolved', 'promoted');--> statement-breakpoint
CREATE TYPE "public"."observation_type" AS ENUM('rate_variance', 'stalled_balance', 'negative_balance', 'multi_mda', 'no_approval_match', 'consecutive_loan');--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"observation_id" uuid NOT NULL,
	"staff_name" varchar(255) NOT NULL,
	"staff_id" varchar(50),
	"mda_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"priority" "exception_priority" DEFAULT 'medium' NOT NULL,
	"status" "exception_status" DEFAULT 'open' NOT NULL,
	"promoted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "observation_type" NOT NULL,
	"staff_name" varchar(255) NOT NULL,
	"staff_id" varchar(50),
	"loan_id" uuid,
	"mda_id" uuid NOT NULL,
	"migration_record_id" uuid,
	"upload_id" uuid,
	"description" text NOT NULL,
	"context" jsonb NOT NULL,
	"source_reference" jsonb,
	"status" "observation_status" DEFAULT 'unreviewed' NOT NULL,
	"reviewer_id" uuid,
	"reviewer_note" text,
	"reviewed_at" timestamp with time zone,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"promoted_exception_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_promoted_by_users_id_fk" FOREIGN KEY ("promoted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_migration_record_id_migration_records_id_fk" FOREIGN KEY ("migration_record_id") REFERENCES "public"."migration_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_upload_id_migration_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."migration_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exceptions_observation_id" ON "exceptions" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "idx_exceptions_mda_id" ON "exceptions" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_exceptions_status" ON "exceptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_observations_type" ON "observations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_observations_mda_id" ON "observations" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_observations_status" ON "observations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_observations_staff_name" ON "observations" USING btree ("staff_name");--> statement-breakpoint
CREATE INDEX "idx_observations_upload_id" ON "observations" USING btree ("upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_observations_type_record" ON "observations" USING btree ("type","migration_record_id");