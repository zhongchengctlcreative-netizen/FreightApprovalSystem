
-- UPDATE FINANCIAL AGGREGATION VIEW --
-- Removing explicit 'FBA' categorization logic. Unmapped FBA codes will now fall into 'OTHER'
-- allowing them to be grouped with unmapped items in the financial analysis.

BEGIN;

DROP VIEW IF EXISTS view_quarterly_financial_aggs;

CREATE OR REPLACE VIEW view_quarterly_financial_aggs WITH (security_invoker = true) AS
SELECT
  f.quarter,
  -- If mapping exists (d.region), use it. Otherwise default to 'OTHER'.
  -- This effectively merges unmapped FBA destinations into 'OTHER' instead of isolating them.
  COALESCE(d.region, 'OTHER') as category,
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
  COALESCE(d.region, 'OTHER');

COMMIT;
