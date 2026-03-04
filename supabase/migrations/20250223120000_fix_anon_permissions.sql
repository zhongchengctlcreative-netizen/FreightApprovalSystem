
-- FIX PERMISSIONS FOR CUSTOM AUTH APP --
-- The previous schema revoked permissions from 'anon'. 
-- Since the app uses custom auth logic on the client, we must allow 'anon' (the client key) 
-- to access the notifications table.

BEGIN;

-- 1. Grant Table Permissions to anon role
GRANT ALL ON TABLE "public"."app_notifications" TO anon;

-- 2. Drop existing restrictive policies that might force 'authenticated' role
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."app_notifications";
DROP POLICY IF EXISTS "Enable access for app users" ON "public"."app_notifications";
DROP POLICY IF EXISTS "Public Access" ON "public"."app_notifications";

-- 3. Create a permissive policy for the application
-- This delegates security to the Application Layer (Layout.tsx / notificationService.ts)
CREATE POLICY "Allow Anon Application Access" ON "public"."app_notifications"
FOR ALL 
TO anon, authenticated, service_role
USING (true) 
WITH CHECK (true);

COMMIT;
