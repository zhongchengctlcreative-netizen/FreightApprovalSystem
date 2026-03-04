
-- FIX NOTIFICATIONS SCHEMA --
-- Run this in Supabase SQL Editor to enable the notification center

BEGIN;

-- 1. Create the Notifications Table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."app_notifications" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  "user_email" text NOT NULL, 
  "title" text NOT NULL,
  "message" text,
  "link" text,
  "is_read" boolean DEFAULT false,
  "type" text DEFAULT 'INFO',
  "created_at" timestamp with time zone DEFAULT now()
);

-- 2. Enable Security
ALTER TABLE "public"."app_notifications" ENABLE ROW LEVEL SECURITY;

-- 3. Create Access Policy
-- Since the app handles users manually (without Supabase Auth login), 
-- we must allow the application key (anon role) to read/write this table.
DROP POLICY IF EXISTS "Enable access for app users" ON "public"."app_notifications";

CREATE POLICY "Enable access for app users" ON "public"."app_notifications"
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 4. Grant Permissions to roles
GRANT ALL ON "public"."app_notifications" TO anon;
GRANT ALL ON "public"."app_notifications" TO authenticated;
GRANT ALL ON "public"."app_notifications" TO service_role;

COMMIT;
