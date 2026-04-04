CREATE TABLE "metric_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_year" integer NOT NULL,
	"snapshot_month" integer NOT NULL,
	"active_loans" integer NOT NULL,
	"total_exposure" numeric(15, 2) NOT NULL,
	"monthly_recovery" numeric(15, 2) NOT NULL,
	"completion_rate" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_metric_snapshots_year_month" ON "metric_snapshots" USING btree ("snapshot_year","snapshot_month");