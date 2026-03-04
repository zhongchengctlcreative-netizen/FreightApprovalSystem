
-- CLEAN SCHEMA SETUP --
BEGIN;

-- 1. Freight Table
CREATE TABLE IF NOT EXISTS "public"."freight_raw_full" (
  id text PRIMARY KEY, status text DEFAULT 'PENDING', quarter text, origin text, origin_code text, destination text, destination_code text, sea_port text, carrier text, vessel_name text, shipping_method text, means_of_conveyance text, container_size text, container_number text, weight_kg numeric, volume_m3 numeric, carton_count numeric, commodity text, estimated_cost numeric, total_actual_cost numeric, origin_cost numeric, ch_origin_cost numeric, fob_cost numeric, freight_charge numeric, destination_cost numeric, duty_cost numeric, invoice_value numeric, etd timestamp with time zone, eta timestamp with time zone, atd timestamp with time zone, ata timestamp with time zone, submission_date timestamp with time zone DEFAULT now(), crd_to_etd integer, transit_origin integer, transit_vessel integer, transit_dest integer, warehouse_arrival integer, total_lead_time integer, bl_awb text, invoice_number text, tax_invoice_number text, requester_name text, requester_email text, notified_approvers text[], first_approver text, second_approver text, l1_approval_date timestamp with time zone, l1_approved_by text, l1_approval_remark text, approved_by text, approval_date timestamp with time zone, approval_remark text, rejected_by text, rejection_date timestamp with time zone, rejection_reason text, cancelled_by text, cancellation_date timestamp with time zone, cancellation_reason text, ai_analysis jsonb, sn integer, week text, year integer, cc_emails text, inventory_value numeric, input_currency text, input_exchange_rate numeric, duty_currency text, exchange_rate_date timestamp with time zone, input_values jsonb DEFAULT '{}'::jsonb
);

-- 2. Support Tables
CREATE TABLE IF NOT EXISTS "public"."app_users" (
  "id" text NOT NULL PRIMARY KEY, "name" text, "email" text, "role" text, "department" text, "status" text, "last_login" text, "passcode" text
);

ALTER TABLE "public"."app_users" DROP CONSTRAINT IF EXISTS "app_users_role_check";

CREATE TABLE IF NOT EXISTS "public"."destination_regions" (
  "destination_code" text NOT NULL PRIMARY KEY, "region" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."carriers" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY, "name" text NOT NULL UNIQUE, "status" text DEFAULT 'ACTIVE', "created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "public"."destinations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY, "code" text NOT NULL UNIQUE, "description" text, "created_at" timestamp with time zone DEFAULT now(), "region" text, "cc_emails" text
);
CREATE TABLE IF NOT EXISTS "public"."financial_metrics" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY, "quarter" text NOT NULL, "category" text NOT NULL, "cost" numeric DEFAULT 0, "revenue" numeric DEFAULT 0, "target_revenue" numeric DEFAULT 0, "updated_at" timestamp with time zone DEFAULT now(), UNIQUE("quarter", "category")
);
CREATE TABLE IF NOT EXISTS "public"."app_email_config" (
  "id" integer PRIMARY KEY, "service_id" text, "template_id" text, "public_key" text, "cc_email" text, "updated_at" timestamp with time zone
);
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

-- 3. Migrations (CRITICAL: Ensure columns exist before View creation)
ALTER TABLE "public"."app_email_config" ADD COLUMN IF NOT EXISTS "cc_email" text;
ALTER TABLE "public"."financial_metrics" ADD COLUMN IF NOT EXISTS "revenue" numeric DEFAULT 0;
ALTER TABLE "public"."destinations" ADD COLUMN IF NOT EXISTS "region" text DEFAULT 'OTHER';
ALTER TABLE "public"."destinations" ADD COLUMN IF NOT EXISTS "cc_emails" text;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "destination_code" text;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "cc_emails" text;
ALTER TABLE "public"."app_users" ADD COLUMN IF NOT EXISTS "passcode" text;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "inventory_value" numeric;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "input_currency" text;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "input_exchange_rate" numeric;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "duty_currency" text;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "exchange_rate_date" timestamp with time zone;
ALTER TABLE "public"."freight_raw_full" ADD COLUMN IF NOT EXISTS "input_values" jsonb DEFAULT '{}'::jsonb;

-- 4. Performance Views (Server-Side Aggregation)

-- Handle potential table conflicts before creating view
DROP TABLE IF EXISTS view_dashboard_stats;
DROP VIEW IF EXISTS view_dashboard_stats;

-- View 1: Dashboard High Level Stats
CREATE OR REPLACE VIEW view_dashboard_stats WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*) FROM freight_raw_full WHERE status IN ('PENDING', 'PENDING_L2')) as pending_count,
  (SELECT COUNT(*) FROM freight_raw_full WHERE status = 'APPROVED') as approved_count,
  (SELECT COUNT(*) FROM freight_raw_full WHERE status = 'REJECTED') as rejected_count,
  (SELECT COUNT(*) FROM freight_raw_full WHERE status = 'CANCELLED') as cancelled_count,
  (SELECT SUM(COALESCE(NULLIF(total_actual_cost, 0), estimated_cost, 0)) FROM freight_raw_full) as total_spend;

-- View 2: Quarterly Trends
DROP VIEW IF EXISTS view_quarterly_trends;
CREATE OR REPLACE VIEW view_quarterly_trends WITH (security_invoker = true) AS
SELECT
  quarter,
  COUNT(*) as count,
  SUM(COALESCE(NULLIF(total_actual_cost, 0), estimated_cost, 0)) as spend,
  SUM(CASE WHEN container_size = '20' THEN 1 ELSE 0 END) as c20_count,
  SUM(CASE WHEN container_size = '20' THEN COALESCE(NULLIF(total_actual_cost, 0), estimated_cost, 0) ELSE 0 END) as c20_cost,
  SUM(CASE WHEN container_size = '40' THEN 1 ELSE 0 END) as c40_count,
  SUM(CASE WHEN container_size = '40' THEN COALESCE(NULLIF(total_actual_cost, 0), estimated_cost, 0) ELSE 0 END) as c40_cost,
  SUM(CASE WHEN container_size = '40HC' THEN 1 ELSE 0 END) as c40hc_count,
  SUM(CASE WHEN container_size = '40HC' THEN COALESCE(NULLIF(total_actual_cost, 0), estimated_cost, 0) ELSE 0 END) as c40hc_cost,
  SUM(CASE WHEN LOWER(shipping_method) LIKE '%air%' THEN 1 ELSE 0 END) as air_count,
  SUM(CASE WHEN LOWER(shipping_method) LIKE '%air%' THEN COALESCE(NULLIF(total_actual_cost, 0), estimated_cost, 0) ELSE 0 END) as air_cost
FROM
  freight_raw_full
WHERE
  status = 'APPROVED'
  AND quarter IS NOT NULL
GROUP BY
  quarter
ORDER BY
  quarter ASC;

-- View 3: Destination Stats (Modified to respect Mapping FIRST)
DROP VIEW IF EXISTS view_destination_stats;
CREATE OR REPLACE VIEW view_destination_stats WITH (security_invoker = true) AS
SELECT
  f.quarter,
  COALESCE(f.destination_code, f.destination) as destination,
  COALESCE(d.region, CASE WHEN f.destination_code LIKE 'FBA%' THEN 'FBA' ELSE 'OTHER' END) as region,
  f.shipping_method,
  SUM(CASE WHEN COALESCE(NULLIF(f.total_actual_cost, 0), f.estimated_cost, 0) > 0 THEN 1 ELSE 0 END) as count,
  SUM(COALESCE(NULLIF(f.total_actual_cost, 0), f.estimated_cost, 0)) as cost,
  SUM(COALESCE(f.weight_kg, 0)) as weight
FROM
  freight_raw_full f
LEFT JOIN
  destinations d ON UPPER(TRIM(f.destination_code)) = UPPER(TRIM(d.code))
WHERE
  f.status = 'APPROVED'
  AND f.quarter IS NOT NULL
GROUP BY
  f.quarter,
  COALESCE(f.destination_code, f.destination),
  COALESCE(d.region, CASE WHEN f.destination_code LIKE 'FBA%' THEN 'FBA' ELSE 'OTHER' END),
  f.shipping_method;

-- View 4: Financial Aggs (Cost/Rev Page) (Modified to respect Mapping FIRST)
DROP VIEW IF EXISTS view_quarterly_financial_aggs;
CREATE OR REPLACE VIEW view_quarterly_financial_aggs WITH (security_invoker = true) AS
SELECT
  f.quarter,
  COALESCE(d.region, CASE WHEN f.destination_code LIKE 'FBA%' THEN 'FBA' ELSE 'OTHER' END) as category,
  SUM(COALESCE(NULLIF(f.total_actual_cost, 0), f.estimated_cost, 0)) as total_cost
FROM
  freight_raw_full f
LEFT JOIN
  destinations d ON UPPER(TRIM(f.destination_code)) = UPPER(TRIM(d.code))
WHERE
  f.status = 'APPROVED'
  AND f.quarter IS NOT NULL
GROUP BY
  f.quarter,
  COALESCE(d.region, CASE WHEN f.destination_code LIKE 'FBA%' THEN 'FBA' ELSE 'OTHER' END);

-- 5. SECURITY (RLS)

ALTER TABLE "public"."freight_raw_full" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."destination_regions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."carriers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."destinations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."financial_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_email_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_notifications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access" ON "public"."freight_raw_full";
DROP POLICY IF EXISTS "Public Access" ON "public"."app_users";
DROP POLICY IF EXISTS "Public Access" ON "public"."destination_regions";
DROP POLICY IF EXISTS "Public Access" ON "public"."carriers";
DROP POLICY IF EXISTS "Public Access" ON "public"."destinations";
DROP POLICY IF EXISTS "Public Access" ON "public"."financial_metrics";
DROP POLICY IF EXISTS "Public Access" ON "public"."app_email_config";
DROP POLICY IF EXISTS "Public Access" ON "public"."app_notifications";

DROP POLICY IF EXISTS "Authenticated Access" ON "public"."freight_raw_full";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."app_users";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."destination_regions";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."carriers";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."destinations";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."financial_metrics";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."app_email_config";
DROP POLICY IF EXISTS "Authenticated Access" ON "public"."app_notifications";

CREATE POLICY "Authenticated Access" ON "public"."freight_raw_full" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."app_users" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."destination_regions" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."carriers" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."destinations" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."financial_metrics" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."app_email_config" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated Access" ON "public"."app_notifications" FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

COMMIT;