# Enterprise Supply Chain Knowledge Hub - Implementation Plan

## The Problem We're Solving

The dp-chatbot is already a working supply chain knowledge hub for Anker NA teams — it syncs Google Drive, does hybrid RAG retrieval, and has a functional chat UI. But it has real pain points that make it frustrating for the people who depend on it:

**The spreadsheet problem is the big one.** Real-world CPFR sheets, PSI data, and team documents don't follow predictable layouts. Headers land on different rows. Every person formats things differently. The current system uses rigid regex patterns that assume row 0 is always the header and that column names will match a hardcoded list. When someone's sheet doesn't fit the mold, the bot just... misses it. Data gets parsed wrong or not at all. This is the core frustration.

**The model is underpowered.** Claude Sonnet 4 with a 1024 token limit can't reason deeply about complex supply chain questions that span multiple data sources. Users ask nuanced questions about how their CPFR drives their PSI, or why forecast numbers changed week over week, and the bot gives shallow answers because it literally runs out of space to think.

**Cross-sheet relationships are invisible.** A workbook might have a PSI tab that feeds a CPFR tab that references a forecast tab — but the system treats each tab as an isolated chunk. It can't connect the dots.

**Responses feel slow and dead.** The user sends a question and stares at a loading spinner for 5-10 seconds with no feedback. Modern chat UIs stream text progressively. This should too.

**It doesn't scale.** Processing happens synchronously when a user triggers it. With hundreds or thousands of files across multiple teams, this won't work. We need background processing that happens automatically.

## What We Want This To Feel Like

When this is done, the bot should feel like it **understands** the team's data. Not just that it can search for keywords, but that it genuinely knows what each spreadsheet contains, how the tabs relate to each other, and can reason about supply chain questions with real depth.

A demand planner should be able to ask "What's driving the forecast variance for A2140 this week?" and get an answer that pulls from the forecast sheet, cross-references the CPFR data, and notices that the PSI ladder shows a pipeline gap — without the planner having to know which files contain what.

The experience should feel responsive and alive. Text streaming in as the bot thinks. Recently updated files surfacing first. The whole knowledge base staying current automatically in the background.

## What's Already Done (This Session)

All code has been written and all files are in place. Here's exactly what was implemented:

---

## Phase 1: Model Upgrade + Streaming (IMPLEMENTED)

### Intent
Give immediate quality improvement. Better model = better answers. Streaming = better UX.

### What Was Done

**`src/lib/modelConfig.js`** (NEW)
- Single source of truth for all model IDs and settings
- Chat: `claude-opus-4-6` (best reasoning for complex supply chain questions)
- Analysis: `claude-sonnet-4-6` (faster/cheaper for batch document analysis)
- Embedding: `text-embedding-3-small` (keep OpenAI for vector embeddings)
- Chat max tokens: 4096 (up from 1024 — 4x more room to reason)
- Temperature: 0.3 (factual, not creative)

**`src/app/api/chat/route.js`** (MODIFIED)
- Imports model config instead of hardcoded model string
- Uses Opus 4.6 with 4096 tokens
- New streaming path: when `?stream=true`, uses `anthropic.messages.stream()` and returns SSE (`text/event-stream`)
- Progressive text + final metadata event with source citations
- Non-streaming path preserved as fallback
- Uses tiered retrieval (Phase 3) instead of basic hybrid retrieval

**`src/components/ChatWindow.jsx`** (MODIFIED)
- Fetches with `?stream=true` by default
- Reads SSE stream with `response.body.getReader()`
- Progressively renders assistant message as tokens arrive
- Parses final SSE event for source citations
- Falls back to JSON parsing if response isn't SSE
- Typing indicator replaced with live text once first tokens arrive

**`src/lib/embeddings.js`** (MODIFIED)
- Uses `models.embedding` from config instead of hardcoded model string
- Uses `embeddingConfig.batchSize` instead of hardcoded 100

---

## Phase 2: LLM-Powered Document Understanding (IMPLEMENTED)

### Intent
This is the highest-impact change. This is what makes the bot understand ANY spreadsheet layout without reformatting. No more regex assumptions about where headers are or what columns are named.

### What Was Done

**`src/lib/documentAnalyzer.js`** (NEW)
Two core functions:

- **`analyzeSheetTab(rows, sheetName, documentTitle, allSheetNames)`**
  - Sends first ~50 rows of a tab to Claude Sonnet 4.6
  - Returns structured analysis: header_row, data_start_row, sheet_type, columns (with meaning/type/normalized name), key_columns, logical_grouping_column, summary
  - This is what eliminates the regex problem — the LLM figures out the structure

- **`analyzeWorkbookRelationships(allTabData, documentTitle)`**
  - Sends all tab names + first 5 rows of each to Claude Sonnet 4.6
  - Returns relationship map: which tabs drive/reference/summarize other tabs
  - Critical for understanding CPFR <-> PSI <-> Forecast connections

- **`getOrCreateAnalysis()`** — Caches analysis with content hashing. If the first 50 rows haven't changed, skip re-analysis.
- **`storeRelationships()`** — Persists relationships to database.
- **`hashSheetContent()`** — SHA-256 of first N rows for change detection.

**`DATABASE_MIGRATION_002_DOCUMENT_ANALYSIS.sql`** (NEW)
All new tables and schema changes:

```
document_analysis        — LLM analysis cache per tab (avoids re-analyzing unchanged sheets)
document_relationships   — Cross-document/tab relationships (drives, references, summarizes, etc.)
document_access_log      — Access tracking for tiered retrieval
document_chunks columns  — chunk_level, parent_chunk_id, section_title, topics (hierarchy)
synced_files column      — content_hash (incremental sync detection)
```

Plus indexes, RLS policies, and auto-update triggers matching existing patterns.

**`src/lib/structuredProcessor.js`** (MODIFIED)
- New `processSheetWithAnalysis()` — uses LLM analysis to find headers on ANY row, map columns dynamically, extract typed fields
- Old `detectSheetType` renamed to `detectSheetTypeFallback` — kept as fallback
- `processAndStoreSpreadsheet` now accepts optional `analyses` parameter — uses LLM parsing when available, regex when not

**`src/app/api/sync/route.js`** (MODIFIED)
- Before processing spreadsheet content, calls `getOrCreateAnalysis()` per tab
- After all tabs analyzed, calls `analyzeWorkbookRelationships()`
- Stores relationships in `document_relationships` table
- Passes analysis to upgraded `processAndStoreSpreadsheet`

---

## Phase 3: Tiered "Netflix Model" Retrieval (IMPLEMENTED)

### Intent
The bot should feel like it knows everything but retrieves intelligently in layers. Recent data and frequently accessed docs should come back fast. Older or cross-team data should still be findable when needed.

### What Was Done

**`src/lib/tieredRetrieval.js`** (NEW)
Three-tier architecture wrapping existing hybridRetrieval:

| Tier | What | When | Speed |
|------|------|------|-------|
| Tier 1 (Hot) | Docs updated in last 7 days + user's team data | Always searched first | Fast |
| Tier 2 (Warm) | All indexed docs via existing hybrid retrieval | When Tier 1 < 3 results | Medium |
| Tier 3 (Cold) | Broader search, lower similarity threshold (0.4 vs 0.7), cross-team | When Tier 1+2 < 3 results | Slower |

After retrieval, expands with related documents from `document_relationships`:
- If a CPFR result is returned, also pulls related PSI and forecast tabs
- Related docs added at 0.5x relevance score (included but don't dominate)

Also: deduplication, access logging (fire-and-forget), tier metadata in responses.

**`src/lib/queryAnalyzer.js`** (NEW)
- Called only for ambiguous queries (when keyword classifier returns `hybrid`)
- Uses Sonnet 4.6 to classify: structured vs semantic, extract entities (SKUs, dates, teams, accounts, metrics), determine scope
- Fast keyword-based classifier in hybridRetrieval stays as the default path (no added latency for clear queries)

**`src/lib/hybridRetrieval.js`** (MODIFIED)
- `buildContextualPrompt()` now handles related documents
- When related docs are included, labels them: "Related Context (cross-tab/cross-document)" with relationship descriptions
- Priority: structured > semantic > related

---

## Phase 4: Intelligent Chunking (IMPLEMENTED)

### Intent
Replace fixed 10-row batches with content-aware chunking. Group data by what it means, not by arbitrary line counts. Every chunk should have a parent for broader context.

### What Was Done

**`src/lib/hierarchicalChunker.js`** (NEW)

For spreadsheets (uses analysis from Phase 2):
- Groups rows by `logical_grouping_column` (e.g., by SKU, by category)
- Each logical group = one chunk (instead of fixed 10-row batches)
- Parent chunk = sheet summary with headers, column descriptions, row count
- If a group exceeds max size, splits into sub-chunks

For documents (section-aware):
- Detects sections via headings (markdown `#`, numbered `1.1`, ALL CAPS)
- Parent chunk = document summary + table of contents
- Child chunks = one per section
- Handles preamble content before first heading

**`src/lib/vectorStore.js`** (MODIFIED)
- `searchSimilar()` now fetches parent chunks for matched results
- Returns both: specific match + parent section context
- Adds `parentContext`, `parentSectionTitle`, `chunkLevel`, `sectionTitle` to results

**`src/lib/chunker.js`** (MODIFIED)
- New `chunkWithStrategy(strategy, params)` dispatcher
- `'hierarchical'` strategy uses hierarchicalChunker
- `'fixed'` strategy falls back to original processDocument
- Old `chunkDocument` export preserved for backward compatibility

**`src/app/api/sync/route.js`** (MODIFIED)
- Spreadsheets: uses hierarchical chunking when analysis available, fixed-size fallback otherwise
- Documents: always uses section-aware chunking via `chunkWithStrategy('hierarchical', ...)`
- Reports `chunkStrategy` in results

---

## Phase 5: Background Processing Pipeline (IMPLEMENTED)

### Intent
Scale to hundreds/thousands of files. Sync and process automatically without user sessions. Users shouldn't have to manually trigger anything.

### What Was Done

**`src/app/api/cron/sync/route.js`** (NEW)
- Runs every 4 hours via Vercel Cron
- Iterates all enabled `sync_configs` that have stored refresh tokens
- Acquires lock per folder, syncs, releases lock
- Uses `getAccessTokenFromRefresh()` for headless auth
- Validates `CRON_SECRET` header

**`src/app/api/cron/process/route.js`** (NEW)
- Runs every 15 minutes via Vercel Cron
- Claims up to 10 pending files atomically
- Full processing pipeline: LLM analysis + relationships + structured data + hierarchical chunking + embeddings
- Handles errors gracefully with document rollback and file release
- `maxDuration = 60` for Vercel Pro

**`src/app/api/sync/progress/route.js`** (NEW)
- GET endpoint returning: files pending, processing, processed (last hour), errors
- Includes recent error details for debugging

**`vercel.json`** (NEW)
```json
{
  "crons": [
    { "path": "/api/cron/sync", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/process", "schedule": "*/15 * * * *" }
  ]
}
```

**`src/lib/driveSync.js`** (MODIFIED)
- `syncFolder()` now checks `modified_time` before upserting
- Skips files that haven't changed since last sync (`sync_status === 'synced'` and same `modified_time`)
- Tracks skipped count in results

---

## What Still Needs To Happen (Deployment Steps)

### 1. Run the database migration
Apply `DATABASE_MIGRATION_002_DOCUMENT_ANALYSIS.sql` to your Supabase instance. This creates the new tables and adds columns to existing tables.

### 2. Set environment variables
- `CRON_SECRET` — random string for Vercel cron auth (set in Vercel dashboard)
- `ANTHROPIC_API_KEY` — should already be set, now used for Opus 4.6

### 3. Store refresh tokens
When users configure sync (the `configure` action), you'll want to also save their Google refresh token to `sync_configs.refresh_token`. This requires:
- Adding a `refresh_token` column to `sync_configs` (not in migration yet — needs encryption consideration)
- Capturing the refresh token from the OAuth flow in `auth.js`

### 4. Deploy to Vercel Pro
Needed for:
- 60-second function timeouts (cron jobs need this)
- Native cron job support (reads from `vercel.json`)
- $20/month

### 5. Test per verification plan
See the Verification Plan section at the end of this doc.

---

## File Inventory

### New Files (10)
| File | Phase |
|------|-------|
| `src/lib/modelConfig.js` | 1 |
| `src/lib/documentAnalyzer.js` | 2 |
| `DATABASE_MIGRATION_002_DOCUMENT_ANALYSIS.sql` | 2 |
| `src/lib/queryAnalyzer.js` | 3 |
| `src/lib/tieredRetrieval.js` | 3 |
| `src/lib/hierarchicalChunker.js` | 4 |
| `src/app/api/cron/sync/route.js` | 5 |
| `src/app/api/cron/process/route.js` | 5 |
| `src/app/api/sync/progress/route.js` | 5 |
| `vercel.json` | 5 |

### Modified Files (9)
| File | Phases |
|------|--------|
| `src/app/api/chat/route.js` | 1, 3 |
| `src/components/ChatWindow.jsx` | 1 |
| `src/lib/structuredProcessor.js` | 2 |
| `src/app/api/sync/route.js` | 2, 4 |
| `src/lib/hybridRetrieval.js` | 3 |
| `src/lib/vectorStore.js` | 4 |
| `src/lib/chunker.js` | 4 |
| `src/lib/driveSync.js` | 5 |
| `src/lib/embeddings.js` | 1 |

### Untouched (reused as-is)
| File | What We Reuse |
|------|---------------|
| `src/lib/auth.js` | Google OAuth flow, domain validation, token refresh |
| `src/lib/supabaseClient.js` | Singleton DB client pattern |
| `src/lib/apiUtils.js` | Auth middleware, validation, error handling, rate limiting |
| `src/lib/logger.js` | JSON logging, PII redaction |
| `src/lib/skuLookup.js` | SKU pattern detection and search |
| `src/lib/googleApi.js` | Google Sheets/Docs API fetching |
| `DATABASE_MIGRATION_001_CONCURRENCY.sql` | All concurrency functions (claim, lock, release) |

---

## Verification Plan

### Phase 1 Testing
- Deploy locally with `npm run dev`
- Open chat, send a complex supply chain query, verify response comes from Opus 4.6 (check API logs for model name)
- Verify streaming: text should appear progressively, not all at once
- Verify non-streaming fallback works if `?stream=true` is removed from ChatWindow
- Confirm max_tokens = 4096 by asking a question that requires a long, detailed answer

### Phase 2 Testing
- Run the database migration against Supabase
- Trigger a sync of a test Google Sheet with non-standard layout (headers on row 3, merged sections, etc.)
- Check `document_analysis` table — verify LLM analysis correctly identifies header row, column types, sheet type
- Check `structured_data` — verify data was parsed using the LLM analysis, not regex fallback
- Verify `content_hash` prevents re-analysis on second sync of unchanged file
- Test with a multi-tab CPFR workbook — verify `document_relationships` captures tab relationships

### Phase 3 Testing
- Ask about a recently updated forecast — verify Tier 1 returns it fast
- Ask about an old SOP — verify it gets found via Tier 3 (broader search)
- Ask about a SKU that appears in both forecast and pipeline — verify related documents are pulled in
- Check `document_access_log` entries are being created
- Verify response metadata includes which tier(s) were used

### Phase 4 Testing
- Sync a large spreadsheet (100+ rows) — verify chunks are grouped by SKU/category, not fixed 10-row batches
- Sync a long SOP document — verify chunks follow section boundaries
- Query for a specific SKU — verify both the precise chunk AND its parent section context are returned
- Verify old `chunkDocument` function still works as fallback

### Phase 5 Testing
- Deploy to Vercel, verify cron jobs appear in Vercel dashboard
- Wait for cron trigger (or manually hit the endpoint with CRON_SECRET header), verify sync runs without user session
- Modify a Google Sheet, wait for next cron cycle, verify only the changed file is re-processed
- Check sync progress endpoint returns accurate counts

---

*Last updated: 2026-02-21*
*All code implemented in a single session. Ready for database migration and deployment.*
