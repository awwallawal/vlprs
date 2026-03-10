CREATE TYPE "public"."deduplication_candidate_status" AS ENUM('pending', 'confirmed_multi_mda', 'reassigned', 'flagged');--> statement-breakpoint
CREATE TABLE "deduplication_candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_mda_id" uuid NOT NULL,
	"child_mda_id" uuid NOT NULL,
	"staff_name" varchar(255) NOT NULL,
	"staff_id" varchar(50),
	"parent_record_count" integer NOT NULL,
	"child_record_count" integer NOT NULL,
	"match_confidence" numeric(3, 2) NOT NULL,
	"match_type" text NOT NULL,
	"status" "deduplication_candidate_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "delineation_result" jsonb;--> statement-breakpoint
ALTER TABLE "deduplication_candidates" ADD CONSTRAINT "deduplication_candidates_parent_mda_id_mdas_id_fk" FOREIGN KEY ("parent_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deduplication_candidates" ADD CONSTRAINT "deduplication_candidates_child_mda_id_mdas_id_fk" FOREIGN KEY ("child_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deduplication_candidates" ADD CONSTRAINT "deduplication_candidates_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dedup_parent_mda" ON "deduplication_candidates" USING btree ("parent_mda_id");--> statement-breakpoint
CREATE INDEX "idx_dedup_child_mda" ON "deduplication_candidates" USING btree ("child_mda_id");--> statement-breakpoint
CREATE INDEX "idx_dedup_status" ON "deduplication_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dedup_staff_name" ON "deduplication_candidates" USING btree ("staff_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_dedup_unique_candidate" ON "deduplication_candidates" USING btree ("parent_mda_id","child_mda_id","staff_name");