CREATE TYPE "public"."employment_event_type" AS ENUM('RETIRED', 'DECEASED', 'SUSPENDED', 'ABSCONDED', 'TRANSFERRED_OUT', 'TRANSFERRED_IN', 'DISMISSED', 'LWOP_START', 'LWOP_END', 'REINSTATED', 'SERVICE_EXTENSION');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('UNCONFIRMED', 'MATCHED', 'DATE_DISCREPANCY');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('PENDING', 'COMPLETED');--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'RETIRED';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'DECEASED';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'SUSPENDED';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'LWOP';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'TRANSFER_PENDING';--> statement-breakpoint
CREATE TABLE "employment_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"loan_id" uuid,
	"mda_id" uuid NOT NULL,
	"event_type" "employment_event_type" NOT NULL,
	"effective_date" date NOT NULL,
	"reference_number" varchar(255),
	"notes" text,
	"new_retirement_date" date,
	"reconciliation_status" "reconciliation_status" DEFAULT 'UNCONFIRMED' NOT NULL,
	"filed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" varchar(50) NOT NULL,
	"loan_id" uuid NOT NULL,
	"outgoing_mda_id" uuid NOT NULL,
	"incoming_mda_id" uuid,
	"outgoing_event_id" uuid,
	"incoming_event_id" uuid,
	"outgoing_confirmed" boolean DEFAULT false NOT NULL,
	"incoming_confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_by" uuid,
	"status" "transfer_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_mda_id_mdas_id_fk" FOREIGN KEY ("mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_events" ADD CONSTRAINT "employment_events_filed_by_users_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_outgoing_mda_id_mdas_id_fk" FOREIGN KEY ("outgoing_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_incoming_mda_id_mdas_id_fk" FOREIGN KEY ("incoming_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_outgoing_event_id_employment_events_id_fk" FOREIGN KEY ("outgoing_event_id") REFERENCES "public"."employment_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_incoming_event_id_employment_events_id_fk" FOREIGN KEY ("incoming_event_id") REFERENCES "public"."employment_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employment_events_staff_id" ON "employment_events" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_employment_events_mda_id" ON "employment_events" USING btree ("mda_id");--> statement-breakpoint
CREATE INDEX "idx_employment_events_reconciliation_status" ON "employment_events" USING btree ("reconciliation_status");--> statement-breakpoint
CREATE INDEX "idx_employment_events_created_at" ON "employment_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_transfers_staff_id" ON "transfers" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_status" ON "transfers" USING btree ("status");