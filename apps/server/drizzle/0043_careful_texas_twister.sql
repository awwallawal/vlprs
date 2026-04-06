ALTER TYPE "public"."migration_upload_status" ADD VALUE 'pending_verification' BEFORE 'validated';--> statement-breakpoint
ALTER TYPE "public"."migration_upload_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "migration_uploads" ADD COLUMN "upload_source" varchar(20) DEFAULT 'admin' NOT NULL;