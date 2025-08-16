-- Add Job Cleanup Mechanism
-- Date: 2025-08-16
-- Purpose: Automatically reset stuck jobs to prevent infinite processing state

-- Function to clean up stuck jobs
CREATE OR REPLACE FUNCTION cleanup_stuck_sync_jobs()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Reset jobs that have been processing for > 30 minutes
  UPDATE sync_jobs
  SET 
    status = 'pending',
    started_at = NULL,
    error_message = COALESCE(error_message, '') || ' [Auto-reset from stuck state]'
  WHERE status = 'processing'
    AND started_at < (NOW() - INTERVAL '30 minutes');
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Log the cleanup (optional, can be removed if not needed)
  IF v_count > 0 THEN
    RAISE NOTICE 'Cleaned up % stuck sync jobs', v_count;
  END IF;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_stuck_sync_jobs TO service_role;

-- Improve get_next_sync_job to include cleanup
CREATE OR REPLACE FUNCTION get_next_sync_job()
RETURNS sync_jobs AS $$
DECLARE
  v_job sync_jobs;
  v_cleaned INTEGER;
BEGIN
  -- First, clean up any stuck jobs
  SELECT cleanup_stuck_sync_jobs() INTO v_cleaned;
  
  -- Select and lock the next pending job
  SELECT * INTO v_job
  FROM sync_jobs
  WHERE status = 'pending'
    AND retry_count < max_retries
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- Mark as processing if found
  IF v_job.id IS NOT NULL THEN
    UPDATE sync_jobs 
    SET status = 'processing', 
        started_at = NOW()
    WHERE id = v_job.id;
    
    -- Refresh the row to get updated data
    SELECT * INTO v_job
    FROM sync_jobs
    WHERE id = v_job.id;
  END IF;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Add a trigger to periodically clean up (commented out for manual control)
-- You can enable this if you want automatic cleanup every time jobs are queried
/*
CREATE OR REPLACE FUNCTION trigger_cleanup_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up stuck jobs when new jobs are added
  PERFORM cleanup_stuck_sync_jobs();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_jobs_cleanup_trigger
  AFTER INSERT ON sync_jobs
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_on_insert();
*/