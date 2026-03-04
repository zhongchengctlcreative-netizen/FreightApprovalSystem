
-- MIGRATION: Add Foreign Keys for Advanced Filtering
-- Run this in Supabase SQL Editor if "Region" or "Status" columns are empty in the app.

BEGIN;

-- 1. Clean up existing constraints to avoid conflicts
ALTER TABLE "public"."freight_raw_full" DROP CONSTRAINT IF EXISTS "fk_freight_destination_code";
-- Remove the bad constraint on 'carrier' if it exists from previous attempts
ALTER TABLE "public"."freight_raw_full" DROP CONSTRAINT IF EXISTS "fk_freight_carrier_name"; 
ALTER TABLE "public"."freight_raw_full" DROP CONSTRAINT IF EXISTS "fk_freight_forwarder_name";

-- 2. Add Foreign Key: Destination Code -> Destinations(code)
ALTER TABLE "public"."freight_raw_full" 
ADD CONSTRAINT "fk_freight_destination_code" 
FOREIGN KEY ("destination_code") 
REFERENCES "public"."destinations" ("code") 
ON UPDATE CASCADE 
ON DELETE SET NULL 
NOT VALID;

-- 3. Add Foreign Key: Forwarder -> Carriers(name)
-- NOTE: 'forwarder' is the normalized column for the Carrier/Forwarder entity. 
-- 'carrier' (text) is now free text for Carrier Line and should NOT have a FK.
ALTER TABLE "public"."freight_raw_full" 
ADD CONSTRAINT "fk_freight_forwarder_name" 
FOREIGN KEY ("forwarder") 
REFERENCES "public"."carriers" ("name") 
ON UPDATE CASCADE 
ON DELETE SET NULL 
NOT VALID;

-- 4. Reload Schema Cache (For PostgREST detection)
NOTIFY pgrst, 'reload schema';

COMMIT;