CREATE TYPE "public"."loan_status" AS ENUM('APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF');--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"staff_name" varchar(255) NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"mda_id" uuid NOT NULL,
	"principal_amount" numeric(15, 2) NOT NULL,
	"interest_rate" numeric(5, 3) NOT NULL,
	"tenure_months" integer NOT NULL,
	"moratorium_months" integer DEFAULT 0 NOT NULL,
	"monthly_deduction_amount" numeric(15, 2) NOT NULL,
	"approval_date" timestamp with time zone NOT NULL,
	"first_deduction_date" timestamp with time zone NOT NULL,
	"loan_reference" varchar(50) NOT NULL,
	"status" "loan_status" DEFAULT 'APPLIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_loan_reference_unique" UNIQUE("loan_reference")
);
--> statement-breakpoint
CREATE TABLE "mda_aliases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mda_id" uuid NOT NULL,
	"alias" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mdas" ADD COLUMN "abbreviation" varchar(100) NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE "mdas" SET "abbreviation" = "code" WHERE "abbreviation" = '';--> statement-breakpoint
ALTER TABLE "mdas" ALTER COLUMN "abbreviation" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "mdas" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mdas" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mda_aliases" ADD CONSTRAINT "mda_aliases_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loans_staff_id" ON "loans" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_loans_mda_id" ON "loans" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_loans_loan_reference" ON "loans" USING btree ("loan_reference");--> statement-breakpoint
CREATE INDEX "idx_loans_status" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mda_aliases_mda_id" ON "mda_aliases" USING btree ("mda_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mda_aliases_alias_lower" ON "mda_aliases" USING btree (LOWER("alias"));