ALTER TYPE "public"."observation_type" ADD VALUE 'period_overlap';--> statement-breakpoint
ALTER TYPE "public"."observation_type" ADD VALUE 'grade_tier_mismatch';--> statement-breakpoint
ALTER TABLE "migration_records" ADD COLUMN "grade_level" text;