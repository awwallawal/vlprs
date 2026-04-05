ALTER TABLE "auto_stop_certificates" ADD COLUMN "notified_mda_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auto_stop_certificates" ADD COLUMN "notified_beneficiary_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auto_stop_certificates" ADD COLUMN "notification_notes" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "beneficiary_email" varchar(255);