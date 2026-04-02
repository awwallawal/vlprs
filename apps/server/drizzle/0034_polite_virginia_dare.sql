CREATE INDEX "idx_observations_created_at" ON "observations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_observations_reviewed_at" ON "observations" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "idx_observations_resolved_at" ON "observations" USING btree ("resolved_at");