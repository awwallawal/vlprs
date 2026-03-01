CREATE TABLE "service_extensions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"original_computed_date" date NOT NULL,
	"new_retirement_date" date NOT NULL,
	"approving_authority_reference" varchar(100) NOT NULL,
	"notes" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_extensions" ADD CONSTRAINT "service_extensions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_extensions" ADD CONSTRAINT "service_extensions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_extensions_loan_id" ON "service_extensions" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_service_extensions_created_at" ON "service_extensions" USING btree ("created_at");