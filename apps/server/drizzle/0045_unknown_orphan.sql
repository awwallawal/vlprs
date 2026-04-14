CREATE TABLE "approval_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"year" integer,
	"list_type" varchar(50) NOT NULL,
	"notes" text,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approved_beneficiaries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"mda_raw" varchar(255),
	"mda_canonical_id" uuid,
	"grade_level" varchar(10),
	"approved_amount" numeric(15, 2),
	"list_type" varchar(50) NOT NULL,
	"principal" numeric(15, 2),
	"interest" numeric(15, 2),
	"total_loan" numeric(15, 2),
	"monthly_deduction" numeric(15, 2),
	"installments_paid" integer,
	"total_principal_paid" numeric(15, 2),
	"total_interest_paid" numeric(15, 2),
	"total_loan_paid" numeric(15, 2),
	"outstanding_principal" numeric(15, 2),
	"outstanding_interest" numeric(15, 2),
	"outstanding_balance" numeric(15, 2),
	"installments_outstanding" integer,
	"collection_date" text,
	"commencement_date" text,
	"match_status" varchar(50) DEFAULT 'UNMATCHED' NOT NULL,
	"matched_loan_id" uuid,
	"match_confidence" integer,
	"first_deduction_month" varchar(7),
	"onboarding_status" varchar(50) DEFAULT 'NOT_YET_OPERATIONAL' NOT NULL,
	"upload_reference" uuid,
	"source_row" integer,
	"source_sheet" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_batches" ADD CONSTRAINT "approval_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_beneficiaries" ADD CONSTRAINT "approved_beneficiaries_batch_id_approval_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."approval_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_beneficiaries" ADD CONSTRAINT "approved_beneficiaries_mda_canonical_id_mdas_id_fk" FOREIGN KEY ("mda_canonical_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_beneficiaries" ADD CONSTRAINT "approved_beneficiaries_matched_loan_id_loans_id_fk" FOREIGN KEY ("matched_loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_approval_batches_year" ON "approval_batches" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_approval_batches_list_type" ON "approval_batches" USING btree ("list_type");--> statement-breakpoint
CREATE INDEX "idx_approved_beneficiaries_batch_id" ON "approved_beneficiaries" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_approved_beneficiaries_mda_canonical_id" ON "approved_beneficiaries" USING btree ("mda_canonical_id");--> statement-breakpoint
CREATE INDEX "idx_approved_beneficiaries_match_status" ON "approved_beneficiaries" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "idx_approved_beneficiaries_onboarding_status" ON "approved_beneficiaries" USING btree ("onboarding_status");--> statement-breakpoint
CREATE INDEX "idx_approved_beneficiaries_name" ON "approved_beneficiaries" USING btree ("name");