-- ============================================================
-- Migration 002: Document Analysis & Tiered Retrieval Schema
-- ============================================================
-- Adds LLM analysis caching, cross-document relationships,
-- access tracking, hierarchical chunks, and incremental sync.
--
-- Prerequisites: DATABASE_SCHEMA.sql and DATABASE_MIGRATION_001_CONCURRENCY.sql
-- ============================================================

-- -----------------------------------------------
-- 1. LLM Analysis Cache
-- Stores per-tab analysis results so unchanged
-- sheets don't need re-analysis.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS document_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  sheet_name TEXT,
  analysis JSONB NOT NULL,
  model_used TEXT NOT NULL,
  content_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_document_analysis_doc_id
  ON document_analysis(document_id);

CREATE INDEX IF NOT EXISTS idx_document_analysis_content_hash
  ON document_analysis(document_id, sheet_name, content_hash);

-- -----------------------------------------------
-- 2. Cross-Document/Tab Relationships
-- Captures how tabs and documents relate to each
-- other (e.g., PSI drives CPFR, forecast feeds pipeline).
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS document_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  target_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  source_sheet_name TEXT,
  target_sheet_name TEXT,
  relationship_type TEXT CHECK (relationship_type IN (
    'drives', 'references', 'summarizes', 'derives_from', 'supplements'
  )),
  description TEXT,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_document_id, target_document_id, source_sheet_name, target_sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_doc_relationships_source
  ON document_relationships(source_document_id);

CREATE INDEX IF NOT EXISTS idx_doc_relationships_target
  ON document_relationships(target_document_id);

-- -----------------------------------------------
-- 3. Document Access Log
-- Tracks which documents are accessed and how,
-- enabling tiered "hot/warm/cold" retrieval.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  access_type TEXT CHECK (access_type IN ('retrieval', 'direct', 'related')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_log_document
  ON document_access_log(document_id);

CREATE INDEX IF NOT EXISTS idx_access_log_created
  ON document_access_log(created_at);

CREATE INDEX IF NOT EXISTS idx_access_log_user
  ON document_access_log(user_id);

-- -----------------------------------------------
-- 4. Hierarchical Chunk Columns
-- Adds parent-child relationships and section
-- metadata to document_chunks for intelligent
-- chunking (section-aware + logical grouping).
-- -----------------------------------------------
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS chunk_level TEXT DEFAULT 'paragraph';

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS section_title TEXT;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS topics TEXT[];

CREATE INDEX IF NOT EXISTS idx_chunks_parent
  ON document_chunks(parent_chunk_id);

CREATE INDEX IF NOT EXISTS idx_chunks_level
  ON document_chunks(chunk_level);

-- -----------------------------------------------
-- 5. Incremental Sync Detection
-- Adds content hash to synced_files so we can
-- detect unchanged files and skip re-processing.
-- -----------------------------------------------
ALTER TABLE synced_files
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- -----------------------------------------------
-- 6. Auto-update timestamps for new tables
-- -----------------------------------------------
DROP TRIGGER IF EXISTS update_document_analysis_updated_at ON document_analysis;
CREATE TRIGGER update_document_analysis_updated_at
  BEFORE UPDATE ON document_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------
-- 7. RLS Policies for new tables
-- Match existing pattern: authenticated users
-- can read and write.
-- -----------------------------------------------
ALTER TABLE document_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- document_analysis policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_analysis' AND policyname = 'Allow authenticated read document_analysis') THEN
    CREATE POLICY "Allow authenticated read document_analysis"
      ON document_analysis FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_analysis' AND policyname = 'Allow authenticated write document_analysis') THEN
    CREATE POLICY "Allow authenticated write document_analysis"
      ON document_analysis FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- document_relationships policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_relationships' AND policyname = 'Allow authenticated read document_relationships') THEN
    CREATE POLICY "Allow authenticated read document_relationships"
      ON document_relationships FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_relationships' AND policyname = 'Allow authenticated write document_relationships') THEN
    CREATE POLICY "Allow authenticated write document_relationships"
      ON document_relationships FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- document_access_log policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_access_log' AND policyname = 'Allow authenticated read document_access_log') THEN
    CREATE POLICY "Allow authenticated read document_access_log"
      ON document_access_log FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_access_log' AND policyname = 'Allow authenticated write document_access_log') THEN
    CREATE POLICY "Allow authenticated write document_access_log"
      ON document_access_log FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
