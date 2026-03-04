
-- RESUBMISSION TRACKING SCHEMA --
BEGIN;

-- 1. Add Columns for Tracking Resubmission
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "resubmission_date" timestamp with time zone;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "resubmission_note" text;

COMMIT;
