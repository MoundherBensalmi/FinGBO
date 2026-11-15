-- Movements get a time of day. Until now the journal showed the time each entry was typed at,
-- so existing entries keep exactly that time (the business runs on Algerian time).
ALTER TABLE "movements" ADD COLUMN "time" time(0);--> statement-breakpoint
UPDATE "movements" SET "time" = date_trunc('second', "created_at" AT TIME ZONE 'Africa/Algiers')::time;--> statement-breakpoint
ALTER TABLE "movements" ALTER COLUMN "time" SET NOT NULL;
