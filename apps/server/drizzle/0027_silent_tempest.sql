ALTER TYPE "public"."observation_type" ADD VALUE 'three_way_variance';--> statement-breakpoint
ALTER TABLE "mda_submissions" ADD COLUMN "three_way_reconciliation" jsonb;