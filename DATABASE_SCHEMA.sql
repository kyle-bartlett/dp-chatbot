-- Anker Supply Chain Knowledge Hub - Database Schema
-- Run this in your Supabase SQL editor

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table (for both Sheets and Docs)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spreadsheet', 'document', 'manual')),
  url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- Document chunks (for semantic search)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embeddings
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Structured data table (for Sheets content)
CREATE TABLE IF NOT EXISTS structured_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_title TEXT,
  document_url TEXT,
  sheet_name TEXT,
  sheet_type TEXT, -- 'forecast', 'pipeline', 'inventory', 'cpfr', 'sales', 'general'
  team_context TEXT DEFAULT 'general', -- 'demand', 'supply', 'ops', 'gtm', 'sales', 'general'
  row_index INTEGER,
  
  -- Common structured fields
  sku TEXT,
  category TEXT,
  date DATE,
  week TEXT,
  
  -- Forecast fields
  forecast NUMERIC,
  units NUMERIC,
  wo1 NUMERIC,
  wo2 NUMERIC,
  wo3 NUMERIC,
  wo4 NUMERIC,
  
  -- Pipeline fields
  eta TEXT,
  etd TEXT,
  quantity NUMERIC,
  po_number TEXT,
  status TEXT,
  
  -- Inventory fields
  units_on_hand NUMERIC,
  available NUMERIC,
  reserved NUMERIC,
  incoming NUMERIC,
  warehouse TEXT,
  
  -- Notes/comments
  notes TEXT,
  
  -- Raw data (full row as JSON)
  raw_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_structured_document_id ON structured_data(document_id);
CREATE INDEX idx_structured_sku ON structured_data(sku);
CREATE INDEX idx_structured_category ON structured_data(category);
CREATE INDEX idx_structured_sheet_type ON structured_data(sheet_type);
CREATE INDEX idx_structured_team_context ON structured_data(team_context);
CREATE INDEX idx_structured_date ON structured_data(date);
CREATE INDEX idx_structured_updated_at ON structured_data(updated_at DESC);

-- Synced files table (tracks Drive files)
CREATE TABLE IF NOT EXISTS synced_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spreadsheet', 'document')),
  url TEXT,
  team_context TEXT DEFAULT 'general',
  modified_time TIMESTAMP WITH TIME ZONE,
  created_time TIMESTAMP WITH TIME ZONE,
  owners JSONB,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
  needs_processing BOOLEAN DEFAULT TRUE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  last_processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_synced_files_drive_id ON synced_files(drive_file_id);
CREATE INDEX idx_synced_files_folder_id ON synced_files(folder_id);
CREATE INDEX idx_synced_files_user_id ON synced_files(user_id);
CREATE INDEX idx_synced_files_needs_processing ON synced_files(needs_processing) WHERE needs_processing = TRUE;
CREATE INDEX idx_synced_files_team_context ON synced_files(team_context);

-- Sync configurations (folder sync settings)
CREATE TABLE IF NOT EXISTS sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  folder_id TEXT UNIQUE NOT NULL,
  folder_name TEXT NOT NULL,
  folder_path JSONB, -- Breadcrumb trail
  team_context TEXT DEFAULT 'general',
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_configs_user_id ON sync_configs(user_id);
CREATE INDEX idx_sync_configs_folder_id ON sync_configs(folder_id);
CREATE INDEX idx_sync_configs_enabled ON sync_configs(sync_enabled) WHERE sync_enabled = TRUE;

-- User preferences (role, team, settings)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'general' CHECK (role IN ('general', 'demand_planner', 'supply_planner', 'operations', 'gtm', 'sales', 'management')),
  team TEXT DEFAULT 'general' CHECK (team IN ('general', 'demand', 'supply', 'ops', 'gtm', 'sales', 'all')),
  default_team_context TEXT DEFAULT 'general',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_prefs_user_id ON user_preferences(user_id);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity float,
  metadata JSONB
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity,
    document_chunks.metadata
  FROM document_chunks
  WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_structured_data_updated_at BEFORE UPDATE ON structured_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_synced_files_updated_at BEFORE UPDATE ON synced_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_configs_updated_at BEFORE UPDATE ON sync_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your security model)
-- These are permissive for development; tighten for production
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE structured_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (authenticated users can read/write their own data)
CREATE POLICY "Allow authenticated read" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write" ON documents FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON document_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write" ON document_chunks FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON structured_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write" ON structured_data FOR ALL TO authenticated USING (true);

CREATE POLICY "Users manage own synced files" ON synced_files FOR ALL TO authenticated USING (true);

CREATE POLICY "Users manage own sync configs" ON sync_configs FOR ALL TO authenticated USING (true);

CREATE POLICY "Users manage own preferences" ON user_preferences FOR ALL TO authenticated USING (true);
