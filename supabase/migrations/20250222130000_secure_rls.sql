
-- SECURE ROW LEVEL SECURITY (RLS) POLICIES
-- Run this migration to enforce strict data isolation based on authenticated user Email/ID.

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE "public"."freight_raw_full" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing permissive policies (from previous schema)
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."freight_raw_full";
DROP POLICY IF EXISTS "Public Access" ON "public"."freight_raw_full";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."app_users";
DROP POLICY IF EXISTS "Public Access" ON "public"."app_users";

-- 3. Define Helper Function to check if user is Admin
-- Assumes app_users table is synced with auth.users via email or trigger
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users 
    WHERE email = auth.jwt() ->> 'email' 
    AND role = 'ADMIN' 
    AND status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Freight Table Policies

-- Policy: Admins can do everything
CREATE POLICY "Admins Full Access" ON "public"."freight_raw_full"
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Policy: Requesters can View/Edit their own requests
CREATE POLICY "Requesters Own Data" ON "public"."freight_raw_full"
FOR ALL
TO authenticated
USING (
  requester_email = auth.jwt() ->> 'email'
  OR 
  -- Allow viewing if listed in CC
  cc_emails ILIKE '%' || (auth.jwt() ->> 'email') || '%'
)
WITH CHECK (
  requester_email = auth.jwt() ->> 'email'
);

-- Policy: Approvers can View/Edit requests assigned to them
CREATE POLICY "Approvers Assigned Data" ON "public"."freight_raw_full"
FOR ALL
TO authenticated
USING (
  first_approver = auth.jwt() ->> 'email'
  OR 
  second_approver = auth.jwt() ->> 'email'
  OR
  -- Allow view if they have approved/rejected it in the past (audit)
  approved_by = UPPER((SELECT name FROM app_users WHERE email = auth.jwt() ->> 'email'))
  OR
  rejected_by = UPPER((SELECT name FROM app_users WHERE email = auth.jwt() ->> 'email'))
)
WITH CHECK (
  -- Only allow updates to status/approval fields if assigned
  first_approver = auth.jwt() ->> 'email' OR second_approver = auth.jwt() ->> 'email'
);

-- 5. User Table Policies

-- Users can view their own profile
CREATE POLICY "Users View Own Profile" ON "public"."app_users"
FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- Admins can view/edit all profiles
CREATE POLICY "Admins Manage Users" ON "public"."app_users"
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

COMMIT;
