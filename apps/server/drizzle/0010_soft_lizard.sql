CREATE TYPE "public"."match_status" AS ENUM('auto_confirmed', 'pending_review', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('exact_name', 'staff_id', 'surname_initial', 'fuzzy_name', 'manual');--> statement-breakpoint
CREATE TABLE "person_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_a_name" text NOT NULL,
	"person_a_staff_id" text,
	"person_a_mda_id" uuid NOT NULL,
	"person_b_name" text NOT NULL,
	"person_b_staff_id" text,
	"person_b_mda_id" uuid NOT NULL,
	"match_type" "match_type" NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"status" "match_status" DEFAULT 'pending_review' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_matches" ADD CONSTRAINT "person_matches_person_a_mda_id_mdas_id_fk" FOREIGN KEY ("person_a_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_matches" ADD CONSTRAINT "person_matches_person_b_mda_id_mdas_id_fk" FOREIGN KEY ("person_b_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_matches" ADD CONSTRAINT "person_matches_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_person_matches_person_a_mda_id" ON "person_matches" USING btree ("person_a_mda_id");--> statement-breakpoint
CREATE INDEX "idx_person_matches_person_b_mda_id" ON "person_matches" USING btree ("person_b_mda_id");--> statement-breakpoint
CREATE INDEX "idx_person_matches_status" ON "person_matches" USING btree ("status");