-- Fix complete_sync_job to also update wallet's last_synced_at
CREATE OR REPLACE FUNCTION complete_sync_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_last_block INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_wallet_address TEXT;
  v_user_id UUID;
BEGIN
  -- Get wallet address and user_id from the job
  SELECT wallet_address, user_id
  INTO v_wallet_address, v_user_id
  FROM sync_jobs
  WHERE id = p_job_id;

  -- Update the job status
  UPDATE sync_jobs
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    completed_at = NOW(),
    error_message = p_error_message,
    last_block_synced = COALESCE(p_last_block, last_block_synced),
    retry_count = CASE 
      WHEN NOT p_success THEN retry_count + 1 
      ELSE retry_count 
    END
  WHERE id = p_job_id;
  
  -- If successful, update wallet's last_synced_at
  IF p_success AND v_wallet_address IS NOT NULL AND v_user_id IS NOT NULL THEN
    UPDATE wallets
    SET 
      last_synced_at = NOW(),
      synced_block_height = COALESCE(p_last_block, synced_block_height),
      sync_in_progress = false
    WHERE wallet_address = v_wallet_address 
      AND user_id = v_user_id;
  END IF;
  
  -- If failed but can retry, reset to pending
  UPDATE sync_jobs
  SET status = 'pending', started_at = NULL
  WHERE id = p_job_id
    AND NOT p_success
    AND retry_count < max_retries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION complete_sync_job TO service_role;

-- Also add a function to clean up stuck jobs
CREATE OR REPLACE FUNCTION cleanup_stuck_sync_jobs()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Reset jobs stuck in processing for more than 10 minutes
  UPDATE sync_jobs
  SET 
    status = 'pending',
    started_at = NULL,
    error_message = 'Reset from stuck processing state after 10 minutes'
  WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_stuck_sync_jobs TO service_role;