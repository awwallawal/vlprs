CREATE TABLE "auto_stop_certificates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"certificate_id" varchar(50) NOT NULL,
	"verification_token" varchar(64) NOT NULL,
	"beneficiary_name" varchar(255) NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"mda_id" uuid NOT NULL,
	"mda_name" varchar(255) NOT NULL,
	"loan_reference" varchar(50) NOT NULL,
	"original_principal" numeric(15, 2) NOT NULL,
	"total_paid" numeric(15, 2) NOT NULL,
	"total_interest_paid" numeric(15, 2) NOT NULL,
	"completion_date" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_stop_certificates" ADD CONSTRAINT "auto_stop_certificates_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_stop_certificates" ADD CONSTRAINT "auto_stop_certificates_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auto_stop_certificates_loan_id" ON "auto_stop_certificates" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auto_stop_certificates_certificate_id" ON "auto_stop_certificates" USING btree ("certificate_id");--> statement-breakpoint
CREATE INDEX "idx_auto_stop_certificates_verification_token" ON "auto_stop_certificates" USING btree ("verification_token");--> statement-breakpoint
CREATE INDEX "idx_auto_stop_certificates_generated_at" ON "auto_stop_certificates" USING btree ("generated_at");