# API Quality Report — Anker Supply Chain Knowledge Hub

**Audit Date:** 2026-02-20
**Scope:** Exhaustive review of every API route, integration boundary, and exported function
**Codebase:** `/Users/kylebartlett/dp-chatbot` (Next.js 14 App Router, JavaScript)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [API Route Audit](#2-api-route-audit)
3. [Integration Boundary Audit](#3-integration-boundary-audit)
4. [Exported Function Audit](#4-exported-function-audit)
5. [Cross-Cutting Findings](#5-cross-cutting-findings)
6. [API Versioning Strategy](#6-api-versioning-strategy)
7. [Remediation Priority Matrix](#7-remediation-priority-matrix)
8. [Appendix A: OpenAPI 3.1 Specification](#appendix-a-openapi-31-specification)

---

## 1. Executive Summary

### Overall Score: 4.8 / 10

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| REST Naming Conventions | 6/10 | 15% | 0.90 |
| Input Validation | 2/10 | 20% | 0.40 |
| Error Response Consistency | 3/10 | 15% | 0.45 |
| HTTP Status Code Accuracy | 6/10 | 10% | 0.60 |
| Integration Boundary Safety | 3/10 | 20% | 0.60 |
| Type Safety and Contracts | 2/10 | 10% | 0.20 |
| Security (Error Leakage) | 3/10 | 10% | 0.30 |
| **TOTAL** | | **100%** | **3.45 / 10** |

### Critical Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 4 | Filter injection vectors, missing auth on public endpoints, error stack leakage, no input validation framework |
| **HIGH** | 8 | No timeouts on external calls, no retry logic, raw error leakage in 5 routes, inconsistent error format |
| **MEDIUM** | 6 | Silent failures in 9 functions, no rate limiting, verbose console logging of sensitive data |
| **LOW** | 5 | REST naming inconsistencies, missing OpenAPI spec, no API versioning, no TypeScript |

---

## 2. API Route Audit

### 2.1 Route Inventory

| Route | Methods | Auth Required | Auth Enforced | Validation |
|-------|---------|--------------|---------------|------------|
| `POST /api/chat` | POST | Yes | Yes (soft) | None |
| `GET /api/context` | GET | Yes | Yes | None |
| `POST /api/context` | POST | Yes | Yes | Manual allowlist |
| `PUT /api/context` | PUT | Yes | Yes (alias) | Manual allowlist |
| `GET /api/documents` | GET | **Yes** | **NO** | None |
| `POST /api/documents` | POST | Yes | Yes | Manual checks |
| `DELETE /api/documents/[id]` | DELETE | **Yes** | **NO** | None |
| `GET /api/sku` | GET | **Yes** | **NO** | Param check only |
| `GET /api/sync` | GET | Yes | Yes | None |
| `POST /api/sync` | POST | Yes | Yes | Manual checks |
| `POST /api/import/folder` | POST | Yes | Yes | Param check only |
| `GET,POST /api/auth/[...nextauth]` | GET, POST | N/A | NextAuth | NextAuth |

### 2.2 REST Naming Convention Audit

**Standard:** REST resources should be nouns (plural), actions via HTTP verbs. No verbs in URLs.

| Issue | Route | Problem | Fix |
|-------|-------|---------|-----|
| F-REST-01 | `POST /api/sync` with `action` body param | Uses RPC-style actions (`configure`, `sync`, `process`) in a single endpoint. This is not RESTful — should be separate resources. | Split into `/api/sync/configs` (CRUD), `/api/sync/jobs` (POST to start sync), `/api/sync/process` (POST to process) |
| F-REST-02 | `GET /api/sync?action=configs` | Uses query params for action dispatch — anti-pattern | `GET /api/sync/configs` |
| F-REST-03 | `GET /api/sync?action=stats` | Same as above | `GET /api/sync/stats` |
| F-REST-04 | `GET /api/sync?action=list&folderId=X` | Same as above | `GET /api/sync/folders/:folderId/files` |
| F-REST-05 | `GET /api/sync?action=metadata&folderId=X` | Same as above | `GET /api/sync/folders/:folderId` |
| F-REST-06 | `GET /api/sync?action=pending` | Same as above | `GET /api/sync/pending` |
| F-REST-07 | `POST /api/import/folder` | Verb in URL ("import") | `POST /api/folders/:folderId/import` or `POST /api/documents/batch` |
| F-REST-08 | `GET /api/sku?q=X` | Resource name is singular | `GET /api/skus?q=X` or `GET /api/skus/search?q=X` |
| F-REST-09 | `PUT /api/context` | Aliases POST — correct REST semantics (idempotent update) but implementation is identical | OK but should verify idempotency |
| F-REST-10 | Mixed `Response.json()` and `NextResponse.json()` | `/api/chat`, `/api/documents`, `/api/sku`, `/api/import/folder` use `Response.json()`. `/api/context`, `/api/sync` use `NextResponse.json()`. | Standardize on one |

**Score: 6/10** — Moderate issues. The `/api/sync` route is effectively an RPC endpoint, not REST.

### 2.3 Input Validation Audit

**Standard:** All user input must be validated with a schema validation library (Zod, Joi, etc.) before processing.

| Route | Validation Method | Gaps |
|-------|------------------|------|
| `POST /api/chat` | **NONE** | `message` not validated (type, length, empty). `history` not validated (array structure, max length). `userContext` not validated. |
| `GET /api/context` | **NONE** | No input — acceptable |
| `POST /api/context` | Manual allowlist | `role` and `team` checked against hardcoded arrays. `preferences` accepted as raw object with zero validation — could contain anything. |
| `GET /api/documents` | **NONE** | No input — acceptable |
| `POST /api/documents` | Manual checks | `url` checked for `docs.google.com` substring (bypassable with `evil.com?redirect=docs.google.com`). No length limits. `customTitle` not validated. `manualContent` not validated (type, length, max size). |
| `DELETE /api/documents/[id]` | **NONE** | `id` not validated as UUID format. Passing a non-UUID string silently returns 404. |
| `GET /api/sku` | Param existence check | `q` checked for presence but not validated for length, content, or injection patterns. |
| `GET /api/sync` | **NONE** | `action` not validated against allowed values before switch logic. `folderId` not validated. |
| `POST /api/sync` | Param existence checks | `action` checked at end (catch-all 400). `folderId` checked per action. `limit` used with `body.limit || 5` — no type or range validation. `syncFrequency` not validated. |
| `POST /api/import/folder` | Param existence check | `folderId` checked for presence only. No format validation. |

**Critical Validation Gap — Filter Injection:**

```javascript
// hybridRetrieval.js:98-100 — called by POST /api/chat
dbQuery = dbQuery.or(
  `sku.ilike.%${query}%,category.ilike.%${query}%,notes.ilike.%${query}%`
)
```

The `query` variable is user input interpolated directly into the Supabase filter string. Characters like `.`, `,`, `(`, `)` in the query could break filter parsing or produce unexpected queries. While Supabase's `.or()` is not raw SQL, the filter DSL has its own syntax that can be manipulated.

```javascript
// import/folder/route.js:53 — folderId interpolated into Drive API query
q: `'${folderId}' in parents and trashed = false`
```

The `folderId` is user input interpolated into a Google Drive API query string. A folderId containing `'` could break the query.

**Score: 2/10** — No validation framework. Manual checks are inconsistent and incomplete.

### 2.4 Error Response Format Audit

**Standard:** All errors should use a consistent envelope: `{ error: { code: string, message: string } }` with optional `details` in non-production.

**Current formats observed:**

```javascript
// Format 1: Simple string
{ error: "Unauthorized" }

// Format 2: String with suggestion
{ error: "API key not configured. Please add ANTHROPIC_API_KEY..." }

// Format 3: String with details field
{ error: "Failed to save document metadata", details: docError.message }

// Format 4: String with random extra fields
{ error: "Failed to generate embeddings for all chunks...",
  chunksExpected: 10, embeddingsGenerated: 7 }

// Format 5: Success with error array embedded
{ success: true, processed: 3, errors: [{ file: "x.docx", error: "..." }] }

// Format 6: Raw error.message (LEAKS INTERNALS)
{ error: error.message }

// Format 7: error.stack (LEAKS STACK TRACE)
{ error: "...", details: error.stack }  // only in dev
```

**7 different error formats across 7 routes.** No error codes, no consistent envelope.

| Route | Formats Used | Leaks Raw Errors |
|-------|-------------|-----------------|
| `POST /api/chat` | Format 2 | No — generic messages |
| `GET /api/context` | Format 1, **Format 6** | **YES** — `error.message` at line 43 |
| `POST /api/context` | Format 1, **Format 6** | **YES** — `error.message` at line 115 |
| `GET /api/documents` | Format 1 | No |
| `POST /api/documents` | Format 2, **Format 3**, Format 4, **Format 7** | **YES** — `error.message` in 6 places, `error.stack` in dev |
| `DELETE /api/documents/[id]` | Format 1 | No |
| `GET /api/sku` | Format 1 | No |
| `GET /api/sync` | Format 1, **Format 6** | **YES** — `error.message` at line 79 |
| `POST /api/sync` | Format 1, **Format 6** | **YES** — `error.message` at line 313 |
| `POST /api/import/folder` | **Format 5**, **Format 6** | **YES** — `error.message` at line 164, `err.message` in errors array |

**Error messages that leak internal details:**

1. Supabase constraint violation messages (table names, column names, constraint names)
2. Google API error responses (quota details, permission details, internal endpoints)
3. OpenAI API error responses (rate limit details, token counts, model info)
4. Node.js stack traces (file paths, line numbers, internal module structure)

**Score: 3/10** — No consistent format. 5 of 7 data-mutating routes leak raw error messages.

### 2.5 HTTP Status Code Audit

| Route | Issue | Current | Correct |
|-------|-------|---------|---------|
| `POST /api/chat` | Missing API key returns 500 | 500 | 503 (Service Unavailable) — configuration issue, not processing error |
| `POST /api/documents` | Missing OpenAI key returns 500 | 500 | 503 |
| `POST /api/documents` | Embedding count mismatch returns 500 | 500 | 500 (correct — server error) |
| `POST /api/import/folder` | Partial success (some files fail) returns 200 | 200 | 207 (Multi-Status) or 200 with partial status — acceptable |
| `GET /api/sync?action=invalid` | Invalid action returns 400 | 400 | 400 (correct) |
| `POST /api/documents` | Document not found at Google returns 404 | 404 | 404 (correct) |
| `POST /api/chat` | No auth but continues with empty user | N/A | Should return 401 if auth required |
| `GET /api/documents` | No auth check at all | 200 | Should return 401 |
| `DELETE /api/documents/[id]` | No auth check at all | 200 | Should return 401 |
| `GET /api/sku` | No auth check at all | 200 | Should return 401 |

**Score: 6/10** — Most codes correct but missing auth produces wrong codes by omission.

---

## 3. Integration Boundary Audit

### 3.1 Google APIs (Sheets v4, Docs v1, Drive v3)

| Check | Status | Details |
|-------|--------|---------|
| **Timeout** | FAIL | No timeout on any Google API call. A hung request blocks the serverless function until the platform kills it (Vercel: 10s free, 60s pro). |
| **Retry Logic** | FAIL | No retry on transient errors (429 Too Many Requests, 503 Service Unavailable). Google APIs commonly rate-limit. |
| **Error Sanitization** | PARTIAL | `fetchSpreadsheet` and `fetchDocument` translate 403/404 codes to user-friendly messages, but the fallback `throw new Error('Failed to fetch spreadsheet: ${error.message}')` leaks raw Google API error text. |
| **Rate Limiting** | FAIL | No client-side rate limiting. `listDriveFiles` paginates with `pageSize: 1000` but no backoff between pages. `getFolderPath` loops API calls with no backoff. |
| **Response Validation** | PARTIAL | Uses optional chaining (`metadata.data.properties?.title`) but does not validate response shape. A changed API contract would silently produce wrong data. |
| **Auth Token Refresh** | PARTIAL | `auth.js` JWT callback refreshes expired Google tokens, but with no retry on refresh failure — user must re-authenticate. No timeout on the refresh fetch. |

**Specific Risk — `getFolderPath` loop** (`driveSync.js`):
```javascript
while (currentId && currentId !== 'root') {
  const metadata = await drive.files.get(...)  // No timeout, no backoff
  currentId = metadata.data.parents?.[0]
}
```
A deeply nested folder structure (20+ levels) or a circular parent reference would produce an unbounded loop of API calls.

### 3.2 OpenAI API (Embeddings)

| Check | Status | Details |
|-------|--------|---------|
| **Timeout** | FAIL | No timeout configured on OpenAI client or individual requests. |
| **Retry Logic** | FAIL | No retry. OpenAI SDK has built-in retry for 429s, but the app does not configure `maxRetries`. |
| **Error Sanitization** | FAIL | On error, logs `validBatch[0]` (user document content), `JSON.stringify(validBatch)` (up to 1000 chars of user content). These could appear in server logs. The error itself is re-thrown and may reach the client via routes that leak `error.message`. |
| **Rate Limiting** | PARTIAL | Batches of 100 texts, but no delay between batches. Rapid batch submission could hit OpenAI rate limits. |
| **Response Validation** | PARTIAL | Accesses `response.data.map(item => item.embedding)` without checking `response.data` exists or has expected structure. |
| **Input Validation** | PASS | Extensive — 9 layers of validation, null checks, type coercion, length truncation at 30,000 chars. Best-validated function in the codebase. |

### 3.3 Anthropic Claude API (Chat)

| Check | Status | Details |
|-------|--------|---------|
| **Timeout** | FAIL | No timeout. Claude can take 30+ seconds for complex queries. |
| **Retry Logic** | FAIL | No retry on transient errors. Anthropic SDK has built-in retry but it is not configured. |
| **Error Sanitization** | PASS | Returns generic "Failed to process request" on error. Handles 401 specifically. |
| **Rate Limiting** | FAIL | No rate limiting per user or globally. A user could spam the chat and exhaust API quota. |
| **Response Validation** | PARTIAL | Accesses `response.content[0].text` without checking array length or content type. A `tool_use` response would crash. |
| **Input Sanitization** | FAIL | `history` from client is passed directly to Claude without sanitization or length limits. `message` is unbounded in length. System prompt is built from database content and user input without injection protection. |

### 3.4 Supabase (PostgreSQL)

| Check | Status | Details |
|-------|--------|---------|
| **Timeout** | FAIL | No timeout on Supabase client or individual queries. |
| **Retry Logic** | PARTIAL | Supabase SDK has built-in retry for connection errors. Not configured explicitly. |
| **Error Sanitization** | FAIL | Raw Supabase errors re-thrown in most functions. Error objects contain: table names, column names, constraint names, SQL hints, and PostgreSQL error codes. |
| **Connection Pooling** | PASS | Uses singleton client pattern. |
| **RLS Bypass** | PASS (intentional) | Uses SERVICE_ROLE_KEY. Auth is handled at the API route level via NextAuth. |
| **Query Safety** | PARTIAL | Supabase SDK parameterizes queries, but the `.or()` filter in `hybridRetrieval.js` uses string interpolation of user input into the filter DSL. |

### 3.5 Integration Boundary Score

**Score: 3/10** — No timeouts, no retry logic, raw error leakage across all boundaries.

---

## 4. Exported Function Audit

### 4.1 Type System

**The project is pure JavaScript.** No TypeScript, no `tsconfig.json`, no `.ts` files. This means:

- No compile-time type checking
- No IDE-enforced contracts between modules
- All type errors are discovered at runtime
- Function signatures are documentation-only

### 4.2 Function Contract Summary

**58 exported functions** across 11 library files and 7 API routes.

| Metric | Count | Percentage |
|--------|-------|------------|
| With JSDoc comments | 53 | 91% |
| With `@param` type annotations | 8 | 14% |
| With runtime input validation | 38 | 66% |
| That throw on error | 24 | 41% |
| That silently return defaults on error | 9 | 16% |
| With documented return shape | 0 | 0% |

### 4.3 Critical Contract Issues

**F-TYPE-01: Silent failure functions**

9 functions catch errors and return empty/default values without notifying callers:

| Function | File | Returns on Error | Risk |
|----------|------|-----------------|------|
| `getDocuments()` | vectorStore.js | `[]` | Caller thinks DB is empty |
| `getStats()` | vectorStore.js | `{totalDocuments:0, totalChunks:0}` | Dashboard shows zeros |
| `searchSimilar()` | vectorStore.js | `[]` | Chat has no context |
| `getSyncConfigs()` | driveSync.js | `[]` | UI shows no configs |
| `getFilesNeedingProcessing()` | driveSync.js | `[]` | Worker thinks nothing to do |
| `claimFilesForProcessing()` | driveSync.js | `[]` | Same as above |
| `acquireSyncLock()` | driveSync.js | `false` | Looks like lock is held |
| `searchStructuredData()` | hybridRetrieval.js | `[]` | No structured results |
| `searchSemanticData()` | hybridRetrieval.js | `[]` | No semantic results |

**F-TYPE-02: Unvalidated object parameters**

```javascript
// addDocument accepts any object shape
export async function addDocument(doc) {
  const { id, title, type, url, metadata } = doc  // No validation
}

// hybridRetrieval accepts untyped context
export async function hybridRetrieval(query, userContext = {}) {
  // Assumes userContext has {role, team} but never checks
}

// processDocument accepts any object
export function processDocument(doc) {
  const { id, title, type, content, url } = doc  // No validation
}
```

**F-TYPE-03: Unsafe optional chaining gaps**

```javascript
// AuthGuard.jsx:77 — Could crash if name is undefined
const initials = session.user.name
  ?.split(' ')
  .map(n => n[0])
  .join('')
// If session.user.name is undefined, ?. returns undefined
// then .map() is called on undefined — CRASH
```

**F-TYPE-04: `clearAll()` in vectorStore.js**

```javascript
export async function clearAll() {
  await supabase.from('documents').delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
}
```

This function deletes ALL documents with no confirmation, no auth check, and no audit trail. It is exported and callable by any module. While not currently called by any route, it is one import away from catastrophe.

**F-TYPE-05: `releaseSyncLock()` is exported but never called**

The function is documented as needing to be called in a `finally` block after sync operations, but no caller invokes it. Sync locks rely entirely on time expiry.

### 4.4 Type Safety Score

**Score: 2/10** — No TypeScript, no runtime validation framework, multiple silent-failure patterns, unsafe object destructuring.

---

## 5. Cross-Cutting Findings

### 5.1 Security Findings

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| SEC-01 | **CRITICAL** | Missing authentication on `GET /api/documents`, `DELETE /api/documents/[id]`, `GET /api/sku` | `documents/route.js`, `documents/[id]/route.js`, `sku/route.js` |
| SEC-02 | **CRITICAL** | Error stack trace leaked to client in development mode | `documents/route.js:396` — `details: process.env.NODE_ENV === 'development' ? error.stack : undefined` |
| SEC-03 | **CRITICAL** | Raw third-party error messages leaked in 5 routes | See Section 2.4 |
| SEC-04 | **HIGH** | User input interpolated into Supabase filter DSL | `hybridRetrieval.js:98-100` |
| SEC-05 | **HIGH** | User input interpolated into Google Drive query string | `import/folder/route.js:53` |
| SEC-06 | **HIGH** | Chat history from client passed to Claude without sanitization or length limits | `chat/route.js:60-66` |
| SEC-07 | **MEDIUM** | User email logged to console on every chat request | `chat/route.js:33` |
| SEC-08 | **MEDIUM** | User document content logged in embedding error handler | `embeddings.js:170-175` |
| SEC-09 | **MEDIUM** | No CORS configuration — relies on Next.js defaults | All routes |
| SEC-10 | **LOW** | `clearAll()` function exported without access control | `vectorStore.js:267` |

### 5.2 Reliability Findings

| ID | Severity | Finding | Impact |
|----|----------|---------|--------|
| REL-01 | **CRITICAL** | No timeouts on any external API call (Google, OpenAI, Anthropic) | Serverless functions hang until platform kills them. User sees generic timeout. |
| REL-02 | **HIGH** | No retry logic on any external API call | Transient failures (network blips, rate limits) become permanent failures. |
| REL-03 | **HIGH** | No rate limiting on any API route | Single user could exhaust API quotas for all users. |
| REL-04 | **HIGH** | `POST /api/chat` — no message length limit | A user could send a megabyte-long message, consuming Claude API tokens. |
| REL-05 | **MEDIUM** | 9 functions silently return defaults on error | Errors invisible to operators; hard to debug in production. |
| REL-06 | **MEDIUM** | No health check endpoint | Cannot monitor service availability. |
| REL-07 | **MEDIUM** | `getFolderPath` — unbounded loop of API calls | Deep/circular folder structures hang the request. |
| REL-08 | **LOW** | `releaseSyncLock()` never called | Sync locks rely entirely on time expiry. |

### 5.3 Observability Findings

| ID | Severity | Finding |
|----|----------|---------|
| OBS-01 | **HIGH** | Excessive `console.log` throughout (50+ instances) — no structured logging framework. Logs will be unqueryable in production. |
| OBS-02 | **HIGH** | No request ID or correlation ID. Cannot trace a request across function calls. |
| OBS-03 | **MEDIUM** | No metrics collection (request latency, error rate, external API latency). |
| OBS-04 | **MEDIUM** | Debug logging in `auth.js` session callback logs on every request — performance and noise concern. |

### 5.4 Consistency Findings

| ID | Finding | Locations |
|----|---------|-----------|
| CON-01 | Mixed use of `Response.json()` and `NextResponse.json()` | `chat`, `documents`, `sku`, `import/folder` use `Response.json()`. `context`, `sync` use `NextResponse.json()`. |
| CON-02 | Inconsistent success response shape: some include `success: true`, some do not | `context POST` and `sync POST` include `success: true`. `documents GET` and `sku GET` do not. |
| CON-03 | Some routes return `{ message }` on success, some do not | `sync`, `context`, `documents/[id]` include `message`. `chat`, `sku`, `documents GET` do not. |
| CON-04 | `chunkDocument` / `processDocument` / `getEmbeddings` / `generateEmbeddings` — export aliases exist for backward compatibility. Multiple names for same function confuses consumers. | `chunker.js`, `embeddings.js` |

---

## 6. API Versioning Strategy

### 6.1 Current State

No API versioning exists. All routes are at the root `/api/` path with no version prefix.

### 6.2 Recommended Strategy: URL Path Versioning

For an enterprise SaaS product, use URL path versioning as it is the most explicit, cacheable, and tooling-friendly approach.

**Phase 1: Introduce v1 (backward-compatible)**

```
/api/v1/chat          -> POST
/api/v1/context       -> GET, POST, PUT
/api/v1/documents     -> GET, POST
/api/v1/documents/:id -> DELETE
/api/v1/skus          -> GET (renamed from /api/sku)
/api/v1/sync/configs  -> GET, POST
/api/v1/sync/jobs     -> POST (replaces action=sync)
/api/v1/sync/process  -> POST (replaces action=process)
/api/v1/sync/stats    -> GET
/api/v1/sync/pending  -> GET
/api/v1/folders/:id   -> GET (metadata)
/api/v1/folders/:id/files -> GET (list files)
/api/v1/folders/:id/import -> POST (replaces /api/import/folder)
/api/v1/health        -> GET (NEW — health check)
```

**Phase 2: Keep unversioned routes as aliases (deprecation period)**

```javascript
// src/app/api/chat/route.js
export { POST } from '@/app/api/v1/chat/route'
// Add deprecation header
```

**Phase 3: Remove unversioned routes after migration period**

### 6.3 Versioning Rules

1. **Breaking changes** (removing fields, changing types, removing endpoints) -> new version
2. **Additive changes** (new optional fields, new endpoints) -> same version
3. **Bug fixes** -> same version
4. **Deprecation notice** -> minimum 6 months before removal
5. **Maximum supported versions** -> 2 (current + previous)

### 6.4 Version Header

All responses should include:
```
X-API-Version: 1
X-API-Deprecated: true  // only on deprecated endpoints
Sunset: Sat, 01 Jan 2027 00:00:00 GMT  // only on deprecated endpoints
```

---

## 7. Remediation Priority Matrix

### Phase 1: Security and Auth (BLOCKING — must fix before any external deployment)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 1 | Add auth checks to `GET /api/documents`, `DELETE /api/documents/[id]`, `GET /api/sku` | 3 files | Small |
| 2 | Sanitize all error responses — never send `error.message` or `error.stack` to client. Create `sanitizeError(error)` helper. | 7 route files | Medium |
| 3 | Sanitize user input in Supabase `.or()` filter — escape `.`, `,`, `(`, `)` characters | `hybridRetrieval.js` | Small |
| 4 | Sanitize `folderId` before Google Drive query interpolation | `import/folder/route.js` | Small |
| 5 | Add `message` length limit (e.g., 10,000 chars) and `history` length limit (e.g., 50 messages) to chat route | `chat/route.js` | Small |
| 6 | Remove `clearAll()` export or gate behind admin auth | `vectorStore.js` | Small |

### Phase 2: Input Validation (HIGH — enterprise quality gate)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 7 | Install Zod. Create validation schemas for every route request body/params. | All routes | Medium |
| 8 | Create standardized error response envelope: `{ error: { code: string, message: string, requestId?: string } }` | All routes, new middleware | Medium |
| 9 | Add UUID format validation for `documents/[id]` route param | `documents/[id]/route.js` | Small |
| 10 | Add URL validation for `documents` POST — use `URL` constructor instead of substring check | `documents/route.js` | Small |

### Phase 3: Reliability (HIGH — production readiness)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 11 | Add timeouts to all external API calls (Google: 30s, OpenAI: 60s, Claude: 90s) | `googleApi.js`, `embeddings.js`, `chat/route.js`, `auth.js` | Medium |
| 12 | Add retry with exponential backoff for Google and OpenAI calls (3 retries, 429/503 triggers) | `googleApi.js`, `driveSync.js`, `embeddings.js` | Medium |
| 13 | Add per-user rate limiting on chat endpoint (e.g., 20 req/min) | `chat/route.js` or middleware | Medium |
| 14 | Add `GET /api/health` endpoint that checks DB connectivity and API key presence | New route | Small |
| 15 | Add max depth guard on `getFolderPath` loop (e.g., 20 levels) | `driveSync.js` | Small |
| 16 | Call `releaseSyncLock()` in finally blocks of sync operations | `sync/route.js` | Small |

### Phase 4: Observability (MEDIUM — operational readiness)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 17 | Replace `console.log/error/warn` with structured logger (pino, winston) | All files | Large |
| 18 | Add request ID middleware — generate UUID per request, pass through all function calls | Middleware + all files | Large |
| 19 | Remove debug logging from `auth.js` session callback, `embeddings.js` error handler (PII in logs) | `auth.js`, `embeddings.js` | Small |

### Phase 5: Architecture (MEDIUM — scalability)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 20 | Refactor `/api/sync` into separate RESTful routes | `sync/route.js` -> multiple files | Medium |
| 21 | Add API versioning (v1 prefix) | All routes | Medium |
| 22 | Convert silent-failure functions to throw, handle at route level | 9 functions across lib/ | Medium |
| 23 | Add TypeScript (or at minimum JSDoc `@param`/`@returns` types) | All files | Large |
| 24 | Standardize on `Response.json()` or `NextResponse.json()` | All routes | Small |

---

## Appendix A: OpenAPI 3.1 Specification

```yaml
openapi: "3.1.0"
info:
  title: Anker Supply Chain Knowledge Hub API
  description: >
    Internal enterprise API for the Anker Charging offline planning assistant.
    Provides document management, semantic search, Google Drive sync, and
    AI-powered chat backed by Claude and RAG retrieval.
  version: "0.1.0"
  contact:
    name: Anker NA Offline Planning Team

servers:
  - url: http://localhost:3000/api
    description: Local development
  - url: https://{deployment}.vercel.app/api
    description: Vercel deployment
    variables:
      deployment:
        default: anker-chatbot

components:
  securitySchemes:
    googleOAuth:
      type: oauth2
      description: Google OAuth 2.0 via NextAuth.js session cookie
      flows:
        authorizationCode:
          authorizationUrl: https://accounts.google.com/o/oauth2/v2/auth
          tokenUrl: https://oauth2.googleapis.com/token
          scopes:
            openid: OpenID Connect
            email: Email address
            profile: User profile
            https://www.googleapis.com/auth/documents.readonly: Read Google Docs
            https://www.googleapis.com/auth/spreadsheets.readonly: Read Google Sheets
            https://www.googleapis.com/auth/drive.readonly: Read Google Drive

  schemas:
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: string
          description: Human-readable error message
          example: "Unauthorized"
        details:
          type: string
          description: Additional error context (development only)

    Document:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
          example: "Q1 2026 Forecast"
        type:
          type: string
          enum: [spreadsheet, document, manual]
        url:
          type: string
          format: uri
          nullable: true
        metadata:
          type: object
          additionalProperties: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    DocumentStats:
      type: object
      properties:
        totalDocuments:
          type: integer
          minimum: 0
        totalChunks:
          type: integer
          minimum: 0

    ChatSource:
      type: object
      properties:
        title:
          type: string
        url:
          type: string
          format: uri
          nullable: true
        type:
          type: string
          enum: [structured, semantic]
        score:
          type: number
          format: float
          minimum: 0
          maximum: 1

    UserContext:
      type: object
      properties:
        user_id:
          type: string
          format: email
        role:
          type: string
          enum: [general, demand_planner, supply_planner, operations, gtm, sales, management]
          default: general
        team:
          type: string
          enum: [general, demand, supply, ops, gtm, sales, all]
          default: general
        default_team_context:
          type: string
        preferences:
          type: object
          additionalProperties: true

    SyncConfig:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
        folder_id:
          type: string
        folder_name:
          type: string
        folder_path:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              name:
                type: string
        team_context:
          type: string
        sync_enabled:
          type: boolean
        sync_frequency:
          type: string
          enum: [hourly, daily, weekly, manual]
        last_sync_at:
          type: string
          format: date-time
          nullable: true

    SKUResult:
      type: object
      properties:
        sku:
          type: string
          example: "A2140"
        exactMatches:
          type: array
          items:
            type: object
            properties:
              text:
                type: string
              score:
                type: number
              documentId:
                type: string
                format: uuid
              documentTitle:
                type: string
        relatedInfo:
          type: array
          items:
            type: object
        totalResults:
          type: integer
          minimum: 0
        error:
          type: string
          nullable: true

    DriveFile:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        mimeType:
          type: string
        webViewLink:
          type: string
          format: uri
        modifiedTime:
          type: string
          format: date-time

    ProcessResult:
      type: object
      properties:
        file:
          type: string
        success:
          type: boolean
        chunks:
          type: integer
        error:
          type: string
          nullable: true

paths:
  /chat:
    post:
      summary: Send a chat message
      description: >
        Sends a user message to the AI assistant. Uses hybrid RAG retrieval
        to find relevant context from documents and spreadsheets, then
        generates a response using Claude.
      security:
        - googleOAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [message]
              properties:
                message:
                  type: string
                  description: The user chat message
                  maxLength: 10000
                history:
                  type: array
                  description: Previous conversation messages
                  maxItems: 50
                  items:
                    type: object
                    required: [role, content]
                    properties:
                      role:
                        type: string
                        enum: [user, assistant]
                      content:
                        type: string
                userContext:
                  type: object
                  properties:
                    role:
                      type: string
                    team:
                      type: string
      responses:
        "200":
          description: Chat response generated
          content:
            application/json:
              schema:
                type: object
                properties:
                  response:
                    type: string
                    description: The assistant reply
                  queryType:
                    type: string
                    enum: [structured, semantic, hybrid]
                  sourcesUsed:
                    type: integer
                  structuredResults:
                    type: integer
                  semanticResults:
                    type: integer
                  sources:
                    type: array
                    items:
                      $ref: "#/components/schemas/ChatSource"
        "401":
          description: Invalid API key
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /context:
    get:
      summary: Get user context
      description: Returns the authenticated user role, team, and preferences.
      security:
        - googleOAuth: []
      responses:
        "200":
          description: User context
          content:
            application/json:
              schema:
                type: object
                properties:
                  context:
                    $ref: "#/components/schemas/UserContext"
        "401":
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

    post:
      summary: Update user context
      description: Updates the authenticated user role, team, and preferences.
      security:
        - googleOAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                role:
                  type: string
                  enum: [general, demand_planner, supply_planner, operations, gtm, sales, management]
                team:
                  type: string
                  enum: [general, demand, supply, ops, gtm, sales, all]
                preferences:
                  type: object
                  additionalProperties: true
      responses:
        "200":
          description: Context updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    const: true
                  context:
                    $ref: "#/components/schemas/UserContext"
                  message:
                    type: string
        "400":
          description: Invalid role or team
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

    put:
      summary: Update user context (alias)
      description: Alias for POST /api/context
      security:
        - googleOAuth: []
      requestBody:
        $ref: "#/paths/~1context/post/requestBody"
      responses:
        $ref: "#/paths/~1context/post/responses"

  /documents:
    get:
      summary: List all documents
      description: Returns all documents in the knowledge base with stats.
      security:
        - googleOAuth: []
      responses:
        "200":
          description: Document list
          content:
            application/json:
              schema:
                type: object
                properties:
                  documents:
                    type: array
                    items:
                      $ref: "#/components/schemas/Document"
                  stats:
                    $ref: "#/components/schemas/DocumentStats"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

    post:
      summary: Add a document
      description: >
        Imports a document from a Google URL or manual text content.
        Processes it into chunks, generates embeddings, and stores
        everything in the vector database.
      security:
        - googleOAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - type: object
                  required: [url]
                  properties:
                    url:
                      type: string
                      format: uri
                      description: Google Docs or Sheets URL
                    title:
                      type: string
                      description: Custom title override
                - type: object
                  required: [content]
                  properties:
                    content:
                      type: string
                      description: Manual text content
                    title:
                      type: string
                      default: "Manual Document"
                    type:
                      type: string
                      default: "document"
      responses:
        "200":
          description: Document imported
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    const: true
                  document:
                    $ref: "#/components/schemas/Document"
                  chunksCreated:
                    type: integer
                  stats:
                    $ref: "#/components/schemas/DocumentStats"
                  warning:
                    type: string
                    nullable: true
        "400":
          description: Invalid input
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Authentication required
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "403":
          description: Access denied to Google document
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          description: Google document not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /documents/{id}:
    delete:
      summary: Delete a document
      description: >
        Atomically deletes a document and all its chunks.
        Uses DELETE...RETURNING to prevent TOCTOU race conditions.
      security:
        - googleOAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Document deleted
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    const: true
                  message:
                    type: string
                  stats:
                    $ref: "#/components/schemas/DocumentStats"
        "404":
          description: Document not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /sku:
    get:
      summary: Search for SKU information
      description: Searches the knowledge base for information about specific SKUs.
      security:
        - googleOAuth: []
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
            minLength: 1
            maxLength: 200
          description: SKU or search query
      responses:
        "200":
          description: SKU search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  query:
                    type: string
                  skus:
                    type: array
                    items:
                      type: string
                  results:
                    type: array
                    items:
                      $ref: "#/components/schemas/SKUResult"
                  totalMatches:
                    type: integer
        "400":
          description: Missing query parameter
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /sync:
    get:
      summary: Get sync data
      description: >
        Retrieves sync configurations, stats, files, or metadata
        based on action parameter.
      security:
        - googleOAuth: []
      parameters:
        - name: action
          in: query
          required: true
          schema:
            type: string
            enum: [configs, stats, list, metadata, pending]
        - name: folderId
          in: query
          required: false
          schema:
            type: string
          description: Required for action=list and action=metadata
      responses:
        "200":
          description: Sync data (shape varies by action)
          content:
            application/json:
              schema:
                oneOf:
                  - type: object
                    properties:
                      configs:
                        type: array
                        items:
                          $ref: "#/components/schemas/SyncConfig"
                  - type: object
                    properties:
                      stats:
                        type: object
                  - type: object
                    properties:
                      files:
                        type: array
                        items:
                          $ref: "#/components/schemas/DriveFile"
                  - type: object
                    properties:
                      metadata:
                        type: object
                      path:
                        type: array
        "400":
          description: Invalid action
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

    post:
      summary: Execute sync action
      description: Configures sync, triggers sync, or processes pending files.
      security:
        - googleOAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [action]
              properties:
                action:
                  type: string
                  enum: [configure, sync, process]
                folderId:
                  type: string
                  description: Required for configure and sync actions
                folderName:
                  type: string
                teamContext:
                  type: string
                  default: general
                syncFrequency:
                  type: string
                  enum: [hourly, daily, weekly, manual]
                  default: daily
                limit:
                  type: integer
                  minimum: 1
                  maximum: 50
                  default: 5
                  description: Max files to process (action=process only)
      responses:
        "200":
          description: Action completed
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    const: true
                  message:
                    type: string
                  config:
                    $ref: "#/components/schemas/SyncConfig"
                  result:
                    type: object
                  processed:
                    type: integer
                  failed:
                    type: integer
                  results:
                    type: array
                    items:
                      $ref: "#/components/schemas/ProcessResult"
        "400":
          description: Invalid action or missing required fields
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /import/folder:
    post:
      summary: Import all files from a Google Drive folder
      description: >
        Lists all files in a Drive folder and imports supported types
        (Docs, Sheets, text files). Uses deterministic UUIDs for
        idempotent re-imports.
      security:
        - googleOAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [folderId]
              properties:
                folderId:
                  type: string
                  description: Google Drive folder ID
      responses:
        "200":
          description: Import completed
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    const: true
                  processed:
                    type: integer
                  skipped:
                    type: integer
                  totalFound:
                    type: integer
                  errors:
                    type: array
                    items:
                      type: object
                      properties:
                        file:
                          type: string
                        error:
                          type: string
        "400":
          description: Missing folderId
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /health:
    get:
      summary: Health check (PROPOSED — does not exist yet)
      description: >
        Returns service health status including database connectivity
        and API key presence.
      responses:
        "200":
          description: Service healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [healthy, degraded, unhealthy]
                  checks:
                    type: object
                    properties:
                      database:
                        type: boolean
                      anthropic_key:
                        type: boolean
                      openai_key:
                        type: boolean
                      google_oauth:
                        type: boolean
                  timestamp:
                    type: string
                    format: date-time
```

---

## End of Report

**Next Steps:** Begin with Phase 1 (Security and Auth) — all 6 items are blocking for any external deployment. Phase 2 (Input Validation with Zod) should follow immediately as it establishes the framework all other improvements build on.
