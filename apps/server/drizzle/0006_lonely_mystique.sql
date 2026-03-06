ALTER TABLE "mdas" ADD COLUMN "parent_mda_id" uuid;--> statement-breakpoint
ALTER TABLE "mdas" ADD CONSTRAINT "mdas_parent_mda_id_mdas_id_fk" FOREIGN KEY ("parent_mda_id") REFERENCES "public"."mdas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mdas_parent_mda_id" ON "mdas" USING btree ("parent_mda_id");