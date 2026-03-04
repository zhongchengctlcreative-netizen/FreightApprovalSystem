
-- FIX PERMISSIONS FOR FINANCIAL VIEW --
-- The anon role needs explicit SELECT permissions on the tables underlying
-- the 'view_quarterly_financial_aggs' because it is defined with 'security_invoker = true'.

BEGIN;

-- 1. Grant SELECT on base tables to anon
GRANT SELECT ON TABLE "public"."freight_raw_full" TO anon;
GRANT SELECT ON TABLE "public"."destinations" TO anon;
GRANT SELECT ON TABLE "public"."financial_metrics" TO anon;

-- 2. Grant SELECT on the views themselves (just in case)
GRANT SELECT ON TABLE "public"."view_quarterly_financial_aggs" TO anon;
GRANT SELECT ON TABLE "public"."view_dashboard_stats" TO anon;
GRANT SELECT ON TABLE "public"."view_quarterly_trends" TO anon;
GRANT SELECT ON TABLE "public"."view_destination_stats" TO anon;

COMMIT;
