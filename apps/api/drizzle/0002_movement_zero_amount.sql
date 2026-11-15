ALTER TABLE "movements" DROP CONSTRAINT "movements_amount_positive";--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_amount_not_negative" CHECK ("movements"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_zero_amount_has_note" CHECK ("movements"."amount" <> 0 OR btrim(coalesce("movements"."note", '')) <> '');