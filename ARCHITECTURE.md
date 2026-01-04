# System Architecture - Anker Supply Chain Knowledge Hub

## Overview

The Anker Supply Chain Knowledge Hub is an AI-powered assistant that provides natural language access to organizational knowledge stored in Google Workspace (Sheets and Docs). It serves multiple teams across the supply chain organization with role-based, context-aware responses.

## Core Design Principles

1. **Live Data Access** - No manual uploads; direct sync from Google Drive
2. **Hybrid Intelligence** - Combine structured data queries with semantic search
3. **Context Awareness** - Responses tailored to user role and team
4. **Scalability** - Handle hundreds of files across multiple teams
5. **Security** - Domain-restricted (@anker.com), role-based access

---

## System Components

### 1. Authentication & Authorization

**Technology:** NextAuth with Google OAuth

**Flow:**
```
User → Google OAuth → Domain Check (@anker.com) → Session Creation
                ↓
        Access Token for Drive API
```

**Features:**
- Domain restriction (anker.com only)
- OAuth scopes: Drive (read), Sheets (read), Docs (read)
- Session management with refresh tokens
- Role-based context stored in user preferences

---

### 2. Data Ingestion Pipeline

#### A. Drive Sync Engine (`driveSync.js`)

**Purpose:** Discover and track files from Drive folders

**Process:**
1. User configures folder(s) to sync
2. System recursively lists all Sheets/Docs in folder
3. Metadata saved to `synced_files` table
4. Modified dates tracked for incremental sync

**Key Functions:**
- `listDriveFiles()` - Recursive folder traversal
- `syncFolder()` - Update file metadata
- `getFilesNeedingProcessing()` - Queue for content fetch

#### B. Content Processors

**For Google Sheets** (`structuredProcessor.js`):
1. Fetch sheet content via Sheets API
2. Detect sheet type (forecast, pipeline, inventory, etc.)
3. Parse rows into structured records
4. Store in `structured_data` table
5. Create searchable text chunks for semantic backup

**For Google Docs** (`chunker.js` + `embeddings.js`):
1. Fetch doc content via Docs API
2. Chunk text (~1000 chars with overlap)
3. Generate embeddings (OpenAI ada-002)
4. Store in `document_chunks` table with vectors

---

### 3. Storage Layer (Supabase PostgreSQL)

#### Schema Design

**documents** - Document metadata
```sql
id, title, type, url, metadata, created_at, updated_at
```

**document_chunks** - Semantic search (vector store)
```sql
id, document_id, content, embedding[1536], metadata, ...
```

**structured_data** - Structured queries (Sheets content)
```sql
id, document_id, sku, category, date, week,
forecast, units, wo1, wo2, wo3, wo4,
eta, quantity, status, notes, raw_data, ...
```

**synced_files** - Sync tracking
```sql
id, drive_file_id, folder_id, name, type, modified_time,
needs_processing, sync_status, document_id, ...
```

**sync_configs** - Folder sync settings
```sql
id, user_id, folder_id, folder_name, team_context,
sync_enabled, sync_frequency, last_sync_at, ...
```

**user_preferences** - User context
```sql
id, user_id, role, team, default_team_context, preferences, ...
```

---

### 4. Hybrid Retrieval Engine (`hybridRetrieval.js`)

#### Query Analysis

**Input:** User query + user context (role, team)

**Process:**
1. Analyze query for intent (structured vs semantic vs hybrid)
2. Extract entities (SKUs, dates, categories)
3. Determine search strategy

**Intent Classification:**

| Pattern | Type | Example |
|---------|------|---------|
| forecast, SKU, WoW, units | Structured | "What's the forecast for B08C5RR1S4?" |
| how to, SOP, explain, guide | Semantic | "How do I submit CPFR?" |
| Mixed keywords | Hybrid | "Show forecast and explain the process" |

#### Structured Search

**Target:** `structured_data` table

**Query Strategy:**
```sql
SELECT * FROM structured_data
WHERE (sku ILIKE '%query%' OR category ILIKE '%query%' OR notes ILIKE '%query%')
  AND team_context = user_team
  AND date >= filter_date_from
ORDER BY updated_at DESC
LIMIT 20
```

**Returns:** Exact data rows (SKUs, numbers, dates)

#### Semantic Search

**Target:** `document_chunks` table (vector similarity)

**Query Strategy:**
1. Generate query embedding
2. Vector similarity search (pgvector)
```sql
SELECT * FROM document_chunks
WHERE 1 - (embedding <=> query_embedding) > 0.7
ORDER BY embedding <=> query_embedding
LIMIT 5
```

**Returns:** Relevant text passages

#### Result Fusion

Combines both result types, ranked by relevance:
- Structured results get score = 1.0 (exact matches)
- Semantic results get cosine similarity score (0-1)
- Filter by team context if specified
- Return unified result set

---

### 5. Chat & Response Generation

**Flow:**
```
User Query
    ↓
Query Analysis (intent detection)
    ↓
Hybrid Retrieval (structured + semantic)
    ↓
Context Builder (format for Claude)
    ↓
Claude API (answer generation)
    ↓
Response with Citations
```

#### Context-Aware Prompting

**System Prompt includes:**
1. Base role description
2. User's role and team
3. Retrieved structured data (formatted)
4. Retrieved semantic chunks (text passages)
5. Source citations

**Example:**
```
You are a supply chain assistant for Anker.
User Role: demand_planner
Team Context: demand

## Structured Data (Spreadsheets):
[1] Forecast_Q1_2024 - Costco
SKU: B08C5RR1S4
Forecast: 1000 units
WoW Change: +15%

## Documents & SOPs:
[2] CPFR_Process_Guide
The CPFR submission process for Costco requires...

## User Query:
What's the Costco forecast for B08C5RR1S4 and how do I submit it?
```

---

### 6. User Experience Layer

#### Role-Based Filtering

**Roles:**
- `general` - No specific filtering
- `demand_planner` - Prioritize forecasts, CPFR
- `supply_planner` - Prioritize pipeline, inventory
- `operations` - Prioritize tracking, logistics
- `gtm` - Prioritize launches, retail
- `sales` - Prioritize accounts, revenue
- `management` - All teams, summaries

**Team Contexts:**
- `general` - All files
- `demand`, `supply`, `ops`, `gtm`, `sales` - Team-specific files
- `all` - Explicit cross-team access

#### Context Switching

Users can:
1. Set default role/team in Settings
2. Override per query ("switch to ops context")
3. Explicitly filter ("show only demand planning files")

---

## Data Flow Diagrams

### Sync Flow

```
┌─────────────┐
│ User Config │ (Select folders to sync)
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Drive API       │ (List files recursively)
│ Folder Traverse │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Save Metadata   │ (synced_files table)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Background Job  │ (Process pending files)
└──────┬──────────┘
       │
       ├──► Sheets ─► Parse Rows ─► structured_data
       │
       └──► Docs ───► Chunk ─► Embed ─► document_chunks
```

### Query Flow

```
┌──────────────┐
│ User Query   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Analyze Intent   │ (Structured? Semantic? Hybrid?)
└──────┬───────────┘
       │
       ├──► Structured Search ──► structured_data table
       │                           └─► Format as text
       │
       └──► Semantic Search ────► Embed query
                                  └─► Vector similarity
                                      └─► document_chunks table
       │
       ▼
┌──────────────────┐
│ Merge Results    │ (Combine + rank by relevance)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Build Context    │ (Format for Claude)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Claude API       │ (Generate answer)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Response         │ (Answer + sources + metadata)
└──────────────────┘
```

---

## API Endpoints

### `/api/chat` (POST)
- Accepts user message, history, userContext
- Returns AI response with sources

### `/api/sync` (GET/POST)
- GET: List sync configs, stats, pending files
- POST: Configure folder sync, trigger sync, process files

### `/api/context` (GET/POST)
- GET: Fetch user preferences
- POST: Update role, team, preferences

### `/api/documents` (GET/POST/DELETE)
- Manage manually uploaded documents

### `/api/import/folder` (POST)
- Import folder (batch document upload)

### `/api/sku` (GET)
- SKU/ASIN lookup

---

## Scalability Considerations

### Performance Optimizations

1. **Incremental Sync**
   - Track modification dates
   - Only process changed files

2. **Batch Processing**
   - Process files in batches (5-10 at a time)
   - Avoid API rate limits

3. **Caching**
   - Cache frequently accessed structured data
   - Cache user preferences

4. **Database Indexes**
   - B-tree on SKU, category, date, team_context
   - Vector index (IVFFlat) on embeddings
   - Composite indexes for common query patterns

### Limits & Constraints

| Resource | Limit | Notes |
|----------|-------|-------|
| Drive API | 1,000 req/100s/user | Use exponential backoff |
| Sheets API | 300 req/min/project | Batch read when possible |
| OpenAI Embeddings | 3,000 req/min | Batch up to 2048 inputs |
| Claude API | 4,000 req/min | Adequate for chat workload |
| Supabase | Project-specific | Scale as needed |

---

## Security Model

### Authentication
- Google OAuth only (@anker.com domain)
- No anonymous access

### Authorization
- Users can only access files they have Drive permission for
- Team context filters results (soft boundary)
- Admin users can access all teams (future)

### Data Privacy
- All data stays in Supabase (controlled environment)
- No data sent to third parties except AI APIs
- Embeddings don't contain original text (cannot reverse)

### API Security
- All API routes check NextAuth session
- OAuth tokens never exposed to client
- Environment variables for all secrets

---

## Future Enhancements

### Phase 2
- [ ] Background sync scheduler (cron job)
- [ ] Real-time file change notifications (Drive webhooks)
- [ ] Planner comments extraction from Sheets
- [ ] Excel file support (upload + parse)

### Phase 3
- [ ] Advanced analytics (trend detection, anomaly detection)
- [ ] Collaborative features (shared bookmarks, annotations)
- [ ] Mobile app (React Native)
- [ ] Slack/Teams integration

### Phase 4
- [ ] Multi-tenancy (support multiple organizations)
- [ ] Fine-tuned models (custom Claude/GPT)
- [ ] Workflow automation (alerts, reminders)
- [ ] Advanced visualization (charts, graphs in chat)

---

## Deployment

### Development
```bash
npm run dev  # Local Next.js server
```

### Production

**Frontend:** Vercel
- Auto-deploy from Git
- Environment variables in Vercel dashboard
- Edge functions for API routes

**Database:** Supabase
- Managed PostgreSQL with pgvector
- Auto-scaling
- Backups enabled

**Monitoring:**
- Vercel Analytics
- Supabase Logs
- Claude/OpenAI usage dashboards

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor API usage (Claude, OpenAI)
- Check sync errors in logs

**Weekly:**
- Review new file count
- Check database growth
- Verify sync configs are active

**Monthly:**
- Database cleanup (old chunks)
- Review and optimize slow queries
- Update dependencies

### Troubleshooting

**Sync not working:**
1. Check Google OAuth scopes
2. Verify folder permissions
3. Check API rate limits
4. Review sync_configs table

**Search returning no results:**
1. Verify documents are processed
2. Check team_context filters
3. Confirm embeddings were generated
4. Test with simple keyword queries

**Slow responses:**
1. Check database indexes
2. Monitor API latency (Claude, OpenAI)
3. Review chunk count per query
4. Optimize retrieval filters
