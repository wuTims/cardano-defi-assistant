-- Migration: Fix RPC Function Parameters
-- Date: 2025-08-16
-- Purpose: Make get_transactions_paginated match what the repository expects

-- ============================================
-- DROP AND RECREATE WITH CORRECT PARAMETERS
-- ============================================
-- The repository calls with filtering parameters, not just pagination
DROP FUNCTION IF EXISTS get_transactions_paginated(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_transactions_paginated(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_action TEXT DEFAULT NULL,
  p_protocol TEXT DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  transaction_id TEXT,
  wallet_address TEXT,
  tx_hash TEXT,
  block_height INTEGER,
  tx_timestamp TIMESTAMPTZ,
  tx_action TEXT,
  tx_protocol TEXT,
  description TEXT,
  net_ada_change TEXT,
  fees TEXT,
  asset_flows JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.id as transaction_id,
    wt.wallet_address,
    wt.tx_hash,
    wt.block_height,
    wt.tx_timestamp,
    wt.tx_action,
    wt.tx_protocol,
    wt.description,
    wt.net_ada_change,
    wt.fees,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'token_unit', af.token_unit,
          'net_change', af.net_change,
          'in_flow', af.in_flow,
          'out_flow', af.out_flow,
          'policy_id', t.policy_id,
          'asset_name', t.asset_name,
          'name', t.name,
          'ticker', t.ticker,
          'decimals', t.decimals,
          'category', t.category
        )
      ) FILTER (WHERE af.id IS NOT NULL),
      '[]'::jsonb
    ) as asset_flows
  FROM wallet_transactions wt
  LEFT JOIN asset_flows af ON wt.id = af.transaction_id
  LEFT JOIN tokens t ON af.token_unit = t.unit
  WHERE wt.user_id = p_user_id
    -- Apply optional filters
    AND (p_action IS NULL OR wt.tx_action = p_action)
    AND (p_protocol IS NULL OR wt.tx_protocol = p_protocol)
    AND (p_from_date IS NULL OR wt.tx_timestamp >= p_from_date)
    AND (p_to_date IS NULL OR wt.tx_timestamp <= p_to_date)
  GROUP BY wt.id, wt.wallet_address, wt.tx_hash, wt.block_height, 
           wt.tx_timestamp, wt.tx_action, wt.tx_protocol, wt.description,
           wt.net_ada_change, wt.fees
  ORDER BY wt.tx_timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_transactions_paginated TO service_role;