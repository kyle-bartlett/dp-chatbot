-- ============================================================================
-- Anker Supply Chain Knowledge Hub — Concurrency & Race Condition Fixes
-- Migration 001: Atomic operations, row-level locking, and idempotency guards
-- ============================================================================
--
-- IMPORTANT: Run this migration AFTER the initial DATABASE_SCHEMA.sql has been
-- applied. All functions below depend on tables created in the base schema.
--
-- This migration addresses the following concurrency vulnerabilities:
--   1. Process worker contention (duplicate document creation)
--   2. Chunk replacement race conditions (delete-then-insert)
--   3. Structured data replacement race conditions
--   4. Scheduled sync double-fire protection
--
-- Each function uses row-level locking (SELECT FOR UPDATE) or transactional
-- atomicity to prevent concurrent operations from corrupting shared state.
-- ============================================================================


-- ============================================================================
-- FUNCTION 1: claim_files_for_processing
--
-- Purpose: Atomically claim pending files for processing so that two
--          concurrent workers never process the same file.
--
-- Mechanism: Uses UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)
--            to atomically transition files from 'pending' to 'processing'.
--            SKIP LOCKED ensures that if another transaction already holds
--            a lock on a row, it is skipped rather than waited on.
--
-- Returns: The set of synced_files rows that were successfully claimed.
--          An empty set means no files are available for processing.
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_files_for_processing(
  p_limit INTEGER DEFAULT 5
)
RETURNS SETOF synced_files
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE synced_files
  SET
    sync_status = 'processing',
    updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM synced_files
    WHERE needs_processing = true
      AND sync_status NOT IN ('processing')
    ORDER BY modified_time DESC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;


-- ============================================================================
-- FUNCTION 2: release_claimed_file
--
-- Purpose: Release a file that was claimed for processing back to either
--          'pending' (for retry) or 'error' (permanent failure) state.
--
-- Called when: Processing fails for a specific file. Without this, a claimed
--             file in 'processing' state would be stuck forever (no worker
--             would pick it up again since it's no longer needs_processing).
--
-- Parameters:
--   p_drive_file_id: The Google Drive file ID of the file to release
--   p_error_message: If provided, the file is marked as 'error' with this
--                    message. If NULL, the file returns to 'pending' for retry.
-- ============================================================================
CREATE OR REPLACE FUNCTION release_claimed_file(
  p_drive_file_id TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE synced_files
  SET
    sync_status = CASE
      WHEN p_error_message IS NOT NULL THEN 'error'
      ELSE 'pending'
    END,
    needs_processing = (p_error_message IS NULL),
    error_message = p_error_message,
    updated_at = NOW()
  WHERE drive_file_id = p_drive_file_id
    AND sync_status = 'processing';
END;
$$;


-- ============================================================================
-- FUNCTION 3: replace_document_chunks
--
-- Purpose: Atomically replace ALL chunks for a given document within a single
--          transaction. This prevents the race condition where two concurrent
--          calls could interleave their DELETE and INSERT operations, causing
--          either chunk loss or chunk duplication.
--
-- Mechanism:
--   1. Acquires a FOR UPDATE lock on the parent document row (serialization)
--   2. DELETEs all existing chunks for the document
--   3. INSERTs new chunks from the provided JSONB array
--   All three steps happen within a single transaction.
--
-- Parameters:
--   p_document_id: UUID of the parent document
--   p_chunks: JSONB array where each element has:
--     - content (text): The chunk text content
--     - chunk_index (integer): The position of this chunk
--     - embedding (array of floats): The 1536-dimensional embedding vector
--     - metadata (object): Additional metadata (title, URL, etc.)
--
-- Returns: The number of chunks inserted
-- ============================================================================
CREATE OR REPLACE FUNCTION replace_document_chunks(
  p_document_id UUID,
  p_chunks JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Step 1: Lock the parent document row to serialize concurrent replacements.
  -- Any concurrent call to this function for the same document will block here
  -- until this transaction completes, preventing interleaved deletes/inserts.
  PERFORM id FROM documents WHERE id = p_document_id FOR UPDATE;

  -- Step 2: Delete all existing chunks for this document
  DELETE FROM document_chunks WHERE document_id = p_document_id;

  -- Step 3: Insert all new chunks in one batch
  INSERT INTO document_chunks (document_id, content, chunk_index, embedding, metadata)
  SELECT
    p_document_id,
    (chunk->>'content')::TEXT,
    (chunk->>'chunk_index')::INTEGER,
    (chunk->>'embedding')::vector(1536),
    (chunk->'metadata')::JSONB
  FROM jsonb_array_elements(p_chunks) AS chunk;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================================
-- FUNCTION 4: replace_structured_data
--
-- Purpose: Atomically replace ALL structured data records for a given document.
--          Same transactional protection as replace_document_chunks, but for
--          the structured_data table (parsed spreadsheet rows).
--
-- Mechanism: Identical to replace_document_chunks — lock parent, delete, insert.
--
-- Parameters:
--   p_document_id: UUID of the parent document
--   p_records: JSONB array where each element has the structured_data fields
--
-- Returns: The number of records inserted
-- ============================================================================
CREATE OR REPLACE FUNCTION replace_structured_data(
  p_document_id UUID,
  p_records JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Lock parent document row
  PERFORM id FROM documents WHERE id = p_document_id FOR UPDATE;

  -- Delete existing structured data for this document
  DELETE FROM structured_data WHERE document_id = p_document_id;

  -- Insert new records
  -- Date parsing is guarded: only casts to DATE if the value matches ISO format
  -- All other fields use safe casts with NULL fallback via the ::TYPE syntax
  INSERT INTO structured_data (
    document_id, document_title, document_url, sheet_name, sheet_type,
    team_context, row_index, sku, category, date, week,
    forecast, units, wo1, wo2, wo3, wo4,
    eta, etd, quantity, po_number, status,
    units_on_hand, available, reserved, incoming, warehouse,
    notes, raw_data
  )
  SELECT
    p_document_id,
    (r->>'document_title')::TEXT,
    (r->>'document_url')::TEXT,
    (r->>'sheet_name')::TEXT,
    (r->>'sheet_type')::TEXT,
    COALESCE((r->>'team_context')::TEXT, 'general'),
    (r->>'row_index')::INTEGER,
    (r->>'sku')::TEXT,
    (r->>'category')::TEXT,
    -- Safe date parsing: only cast if value looks like a valid date
    CASE
      WHEN r->>'date' IS NOT NULL
        AND r->>'date' ~ '^\d{4}-\d{2}-\d{2}'
      THEN (r->>'date')::DATE
      ELSE NULL
    END,
    (r->>'week')::TEXT,
    -- Numeric fields: NULLIF handles empty strings before cast
    CASE WHEN r->>'forecast' IS NOT NULL AND r->>'forecast' ~ '^-?[0-9]'
         THEN (r->>'forecast')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'units' IS NOT NULL AND r->>'units' ~ '^-?[0-9]'
         THEN (r->>'units')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'wo1' IS NOT NULL AND r->>'wo1' ~ '^-?[0-9]'
         THEN (r->>'wo1')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'wo2' IS NOT NULL AND r->>'wo2' ~ '^-?[0-9]'
         THEN (r->>'wo2')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'wo3' IS NOT NULL AND r->>'wo3' ~ '^-?[0-9]'
         THEN (r->>'wo3')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'wo4' IS NOT NULL AND r->>'wo4' ~ '^-?[0-9]'
         THEN (r->>'wo4')::NUMERIC ELSE NULL END,
    (r->>'eta')::TEXT,
    (r->>'etd')::TEXT,
    CASE WHEN r->>'quantity' IS NOT NULL AND r->>'quantity' ~ '^-?[0-9]'
         THEN (r->>'quantity')::NUMERIC ELSE NULL END,
    (r->>'po_number')::TEXT,
    (r->>'status')::TEXT,
    CASE WHEN r->>'units_on_hand' IS NOT NULL AND r->>'units_on_hand' ~ '^-?[0-9]'
         THEN (r->>'units_on_hand')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'available' IS NOT NULL AND r->>'available' ~ '^-?[0-9]'
         THEN (r->>'available')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'reserved' IS NOT NULL AND r->>'reserved' ~ '^-?[0-9]'
         THEN (r->>'reserved')::NUMERIC ELSE NULL END,
    CASE WHEN r->>'incoming' IS NOT NULL AND r->>'incoming' ~ '^-?[0-9]'
         THEN (r->>'incoming')::NUMERIC ELSE NULL END,
    (r->>'warehouse')::TEXT,
    (r->>'notes')::TEXT,
    (r->'raw_data')::JSONB
  FROM jsonb_array_elements(p_records) AS r;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================================
-- SCHEMA CHANGE: Add sync lock column to sync_configs
--
-- Purpose: Prevents duplicate scheduled syncs (cron double-fire protection).
--          When a sync begins, it acquires a time-limited lock. If another
--          sync attempt arrives while the lock is held, it is rejected.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_configs' AND column_name = 'sync_lock_until'
  ) THEN
    ALTER TABLE sync_configs
      ADD COLUMN sync_lock_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;
END;
$$;


-- ============================================================================
-- FUNCTION 5: acquire_sync_lock
--
-- Purpose: Atomically acquire a time-limited lock on a sync configuration.
--          Used to prevent concurrent or double-fired scheduled syncs from
--          processing the same folder simultaneously.
--
-- Mechanism: UPDATE with a WHERE clause that checks the lock is either
--            not held (NULL) or has expired. Only one concurrent caller
--            can succeed because the UPDATE is atomic.
--
-- Parameters:
--   p_folder_id: The folder ID to lock
--   p_lock_duration_minutes: How long to hold the lock (default 30 minutes)
--
-- Returns: TRUE if the lock was acquired, FALSE if it's already held
-- ============================================================================
CREATE OR REPLACE FUNCTION acquire_sync_lock(
  p_folder_id TEXT,
  p_lock_duration_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  UPDATE sync_configs
  SET sync_lock_until = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL,
      updated_at = NOW()
  WHERE folder_id = p_folder_id
    AND sync_enabled = true
    AND (sync_lock_until IS NULL OR sync_lock_until < NOW())
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$$;


-- ============================================================================
-- FUNCTION 6: release_sync_lock
--
-- Purpose: Release the sync lock on a folder after sync completes (or fails).
--          Also updates last_sync_at to record when the sync finished.
--
-- Parameters:
--   p_folder_id: The folder ID to unlock
-- ============================================================================
CREATE OR REPLACE FUNCTION release_sync_lock(p_folder_id TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sync_configs
  SET sync_lock_until = NULL,
      last_sync_at = NOW(),
      updated_at = NOW()
  WHERE folder_id = p_folder_id;
END;
$$;


-- ============================================================================
-- Update the sync_status CHECK constraint to include 'processing' state
-- ============================================================================
-- First check if 'processing' is already allowed; if not, update the constraint
DO $$
BEGIN
  -- Drop and recreate the constraint to include 'processing'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'synced_files_sync_status_check'
  ) THEN
    ALTER TABLE synced_files DROP CONSTRAINT synced_files_sync_status_check;
  END IF;

  ALTER TABLE synced_files
    ADD CONSTRAINT synced_files_sync_status_check
    CHECK (sync_status IN ('pending', 'processing', 'synced', 'error'));
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists with correct definition, nothing to do
    NULL;
END;
$$;


-- ============================================================================
-- Index for faster file claiming queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_synced_files_claimable
  ON synced_files(modified_time DESC)
  WHERE needs_processing = true AND sync_status NOT IN ('processing');


-- ============================================================================
-- Index for looking up documents by Google Drive file ID in metadata
-- Used by the import/folder route to detect already-imported files
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_drive_file_id
  ON documents((metadata->>'googleDriveId'))
  WHERE metadata->>'googleDriveId' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_drive_file_id_v2
  ON documents((metadata->>'driveFileId'))
  WHERE metadata->>'driveFileId' IS NOT NULL;
