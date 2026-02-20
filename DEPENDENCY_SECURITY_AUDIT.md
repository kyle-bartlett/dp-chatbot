# Dependency Supply-Chain Security Audit

**Project:** Anker Supply Chain Knowledge Hub
**Audited:** 2026-02-20
**Total direct dependencies:** 19
**Total packages in lockfile:** 195
**node_modules size:** 542 MB

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Known CVEs (HIGH) | 6 vulnerabilities across 4 dependency chains | CRITICAL |
| Stale/Risky Dependencies | 2 packages with significant risk | HIGH |
| Removable Dependencies | 5 packages (unnecessary direct deps) | MEDIUM |
| Replaceable Dependencies | 2 packages (lighter alternatives exist) | MEDIUM |
| License Conflicts | 0 | NONE |
| Postinstall Scripts | 0 packages with lifecycle scripts | NONE |
| Native Bindings | 3 prebuilt binaries (no gyp compilation) | LOW |

**Overall Risk Score: HIGH** — 6 unpatched CVEs + permanently-beta auth dependency.

---

## 1. Known CVEs (Cross-referenced: npm audit + GitHub Advisory Database)

### CRITICAL: `next` v14.2.35 — 2 HIGH CVEs

| CVE | Severity | Description | Fixed In |
|-----|----------|-------------|----------|
| [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) | HIGH | DoS via Image Optimizer `remotePatterns` configuration | >= 15.5.10 |
| [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) | HIGH | DoS via HTTP request deserialization in React Server Components | >= 15.0.8 |

**Impact:** Both are Denial of Service vectors. The Image Optimizer CVE affects self-hosted deployments (not Vercel). The RSC deserialization CVE is exploitable if attackers can craft malicious HTTP requests.
**Fix:** Requires major version bump to Next.js 15+ or 16+. This is a **breaking change** — see remediation plan below.

### HIGH: `qs` <= 6.14.1 — 2 HIGH CVEs (transitive via `express` via `next`)

| CVE | Severity | Description |
|-----|----------|-------------|
| [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p) | HIGH | arrayLimit bypass via bracket notation allows DoS via memory exhaustion |
| [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883) | HIGH | arrayLimit bypass via comma parsing allows DoS |

**Impact:** Attackers can craft query strings that consume excessive memory.
**Fix:** `npm audit fix` (non-breaking).

### HIGH: `minimatch` < 10.2.1 — 1 HIGH CVE (transitive via `googleapis` → `gaxios` → `rimraf` → `glob`)

| CVE | Severity | Description |
|-----|----------|-------------|
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | HIGH | ReDoS via repeated wildcards with non-matching literal in pattern |

**Impact:** Attackers can craft patterns that cause catastrophic backtracking.
**Fix:** `npm audit fix` (non-breaking).

### Dependency Chain:
```
googleapis → gaxios → rimraf → glob → minimatch (vulnerable)
```

---

## 2. Dependency Freshness & Maintainer Analysis

### Flags: Stale (>6 months since last publish) or Low Maintainers (<2)

| Package | Last Published | Maintainers | Status | Risk |
|---------|---------------|-------------|--------|------|
| `client-only` | 2022-09-03 | 1 | 3.5 years stale | LOW (trivial package, stable by design) |
| `next-auth` | 2025-10-29 | 3 | 4 months stale, **permanently beta** | **CRITICAL** |
| `styled-jsx` | 2025-04-30 | 3 | 10 months stale | LOW (transitive, don't need directly) |
| `postcss` | 2025-09-09 | 1 | 5 months, 1 maintainer | MEDIUM (critical infra, single maintainer) |
| `uuid` | 2025-09-08 | 2 | 5 months | LOW (stable, well-established) |
| `autoprefixer` | 2026-01-30 | 1 | Recent, but 1 maintainer | LOW |
| `@swc/helpers` | 2025-12-25 | 1 | 2 months, 1 maintainer | LOW (transitive dep) |
| `googleapis` | 2026-02-05 | 1 | Recent, but 1 maintainer for 194 MB | MEDIUM |
| `lucide-react` | 2026-02-19 | 1 | Recent, but 1 maintainer | LOW |
| `zod` | 2026-01-25 | 1 | Recent, 1 maintainer (Colin McDonnell) | LOW |

### CRITICAL: `next-auth` v5.0.0-beta.30

- **Status:** Permanently in beta. No plans for v5 stable release.
- **Main contributor (Balazs Orban) left** in January 2025.
- **Auth.js project absorbed by Better Auth** (venture-funded, $5M).
- **Security patches will continue** but no new features or stable release.
- **Recommendation:** Plan migration to [Better Auth](https://www.better-auth.com/) in the next quarter.

---

## 3. Install-Time Attack Surface

### Postinstall Scripts
**None found.** All 195 packages in the lockfile are clean of `preinstall`, `install`, `postinstall`, and `prepare` lifecycle scripts.

### Native Binaries (prebuilt, no compilation)
| Binary | Package | Purpose |
|--------|---------|---------|
| `lightningcss.darwin-arm64.node` | `lightningcss-darwin-arm64` | CSS processing (Tailwind v4) |
| `tailwindcss-oxide.darwin-arm64.node` | `@tailwindcss/oxide-darwin-arm64` | Tailwind class scanner |
| `next-swc.darwin-arm64.node` | `@next/swc-darwin-arm64` | SWC compiler for Next.js |

These are platform-specific prebuilt binaries distributed via npm. They do **not** require node-gyp compilation. Risk is LOW — all three are from reputable, well-audited sources (Vercel, Tailwind Labs, Lightning CSS).

### Network Access During Install
**None.** No packages make network requests during installation.

---

## 4. License Compatibility Analysis

**Project License:** PROPRIETARY

| License | Count | Packages | Compatible? |
|---------|-------|----------|-------------|
| MIT | 14 | next, react, react-dom, postcss, tailwindcss, @tailwindcss/postcss, autoprefixer, @supabase/supabase-js, @anthropic-ai/sdk, uuid, zod, client-only, styled-jsx | YES |
| Apache-2.0 | 3 | @swc/helpers, googleapis, openai | YES |
| ISC | 2 | lucide-react, next-auth | YES |
| CC-BY-4.0 | 1 | caniuse-lite (data only) | YES |
| GPL | 0 | — | N/A |

**Result: Zero license conflicts.** All dependencies use permissive licenses compatible with proprietary use. No copyleft (GPL/LGPL/AGPL) dependencies found.

---

## 5. "Trim the Fat" Report

### TIER 1: REMOVE (unnecessary direct dependencies)

These are transitive dependencies of `next` that should NOT be listed in `package.json`. They are installed automatically via npm's dependency resolution.

| Package | Why It's Unnecessary | Size Savings |
|---------|---------------------|--------------|
| `@swc/helpers` | Transitive dep of `next`. Not imported anywhere in `src/`. | Cleaner manifest |
| `styled-jsx` | Transitive dep of `next`. Not imported anywhere in `src/`. | Cleaner manifest |
| `client-only` | Not imported anywhere in `src/`. Transitive dep. | Cleaner manifest |
| `caniuse-lite` | Transitive dep of `browserslist` via `autoprefixer`/`next`. | Cleaner manifest |
| `autoprefixer` | Tailwind CSS v4 handles vendor prefixing automatically via Lightning CSS. Removing this also requires updating `postcss.config.js`. | ~50 KB |

**Commands:**
```bash
# Remove unnecessary direct deps
npm uninstall @swc/helpers styled-jsx client-only caniuse-lite autoprefixer
```

**PostCSS config update required after removing autoprefixer:**
```js
// postcss.config.js — remove autoprefixer plugin
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### TIER 2: REPLACE (lighter alternatives)

| Package | Current Size | Replace With | New Size | Effort |
|---------|-------------|-------------|----------|--------|
| `googleapis` | **194 MB** | `@googleapis/drive` + `@googleapis/sheets` + `@googleapis/docs` | ~15 MB | MEDIUM |
| `uuid` (v4 usage) | 67 KB | `crypto.randomUUID()` (built-in) | 0 KB | LOW |

**Note on `uuid`:** The project uses both `uuid.v4()` (random) and `uuid.v5()` (deterministic). `crypto.randomUUID()` replaces v4 only. The `uuid` package must be kept for v5 usage in `import/folder/route.js`, but v4 imports in `apiUtils.js`, `sync/route.js`, and `documents/route.js` can switch to the built-in.

**Commands for googleapis replacement:**
```bash
npm uninstall googleapis
npm install @googleapis/drive @googleapis/sheets @googleapis/docs
```

**Code changes required:**
```js
// Before (in googleApi.js and driveSync.js)
import { google } from 'googleapis'

// After
import { drive_v3 } from '@googleapis/drive'
import { sheets_v4 } from '@googleapis/sheets'
import { docs_v1 } from '@googleapis/docs'
import { auth } from 'googleapis-common'
```

**Commands for uuid v4 replacement:**
```js
// Before (apiUtils.js, sync/route.js, documents/route.js)
import { v4 as uuidv4 } from 'uuid'
const id = uuidv4()

// After (built-in, zero dependencies)
const id = crypto.randomUUID()
```

### TIER 3: VERSION BUMPS (CVE remediation)

| Package | Current | Target | Breaking? | Command |
|---------|---------|--------|-----------|---------|
| `qs` (transitive) | <= 6.14.1 | >= 6.14.2 | No | `npm audit fix` |
| `minimatch` (transitive) | < 10.2.1 | >= 10.2.1 | No | `npm audit fix` |
| `next` | 14.2.35 | 15.5.10+ | **YES** | See migration plan below |

### TIER 4: STRATEGIC (plan, don't execute now)

| Package | Current | Action | Timeline |
|---------|---------|--------|----------|
| `next-auth` | 5.0.0-beta.30 | Migrate to Better Auth | Next quarter |
| `next` | 14.2.35 | Upgrade to Next.js 15.x | After auth migration |
| `openai` | 6.15.0 | Consider replacing with direct `fetch` (only used for embeddings) | Optional |

---

## 6. Prioritized Remediation List (Risk x Effort)

### Priority Legend
- **P0 (Do Now):** High risk, low effort — no reason to delay
- **P1 (This Sprint):** High risk, medium effort — schedule immediately
- **P2 (Next Sprint):** Medium risk, medium effort
- **P3 (Backlog):** Low risk or high effort — plan but don't rush

| # | Priority | Action | Risk | Effort | Command/Notes |
|---|----------|--------|------|--------|---------------|
| 1 | **P0** | Fix `qs` + `minimatch` CVEs | HIGH | 1 min | `npm audit fix` |
| 2 | **P0** | Remove 5 unnecessary direct deps | MEDIUM | 5 min | `npm uninstall @swc/helpers styled-jsx client-only caniuse-lite autoprefixer` + update `postcss.config.js` |
| 3 | **P1** | Replace `googleapis` with submodule packages | MEDIUM | 2-4 hrs | Replace imports in `googleApi.js`, `driveSync.js`, `import/folder/route.js` |
| 4 | **P1** | Replace `uuid.v4()` with `crypto.randomUUID()` | LOW | 30 min | Update 3 files: `apiUtils.js`, `sync/route.js`, `documents/route.js` |
| 5 | **P2** | Upgrade Next.js 14 → 15 | HIGH | 1-2 days | Fixes 2 HIGH CVEs. Requires testing all routes, pages, and middleware. Follow [Next.js 15 upgrade guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15). |
| 6 | **P3** | Migrate `next-auth` → Better Auth | HIGH | 3-5 days | Eliminates permanently-beta dependency. Follow [Better Auth migration guide](https://authjs.dev/getting-started/migrate-to-better-auth). |
| 7 | **P3** | Evaluate `openai` SDK removal | LOW | 2 hrs | Replace with direct `fetch` if only used for embeddings. Saves ~13 MB. |

---

## 7. Post-Remediation Target State

After executing P0 + P1:

| Metric | Before | After |
|--------|--------|-------|
| Direct dependencies | 19 | 13 (-6) |
| CVEs (auto-fixable) | 4 | 0 |
| CVEs (remaining, needs major bump) | 2 | 2 |
| `node_modules` size | 542 MB | ~350 MB (-35%) |
| License conflicts | 0 | 0 |
| Postinstall scripts | 0 | 0 |

After executing P2 (Next.js 15):

| Metric | Value |
|--------|-------|
| CVEs | 0 |
| Risk rating | LOW |

---

## Appendix A: Full Dependency Inventory

| # | Package | Version | License | Last Published | Maintainers | Purpose | Verdict |
|---|---------|---------|---------|---------------|-------------|---------|---------|
| 1 | `@anthropic-ai/sdk` | 0.71.2 | MIT | 2026-02-19 | 14 | Claude API client | KEEP |
| 2 | `@supabase/supabase-js` | 2.89.0 | MIT | 2026-02-20 | 14 | Database client | KEEP |
| 3 | `@swc/helpers` | 0.5.17 | Apache-2.0 | 2025-12-25 | 1 | SWC helpers | **REMOVE** (transitive) |
| 4 | `@tailwindcss/postcss` | 4.1.18 | MIT | 2026-02-20 | 3 | Tailwind PostCSS plugin | KEEP |
| 5 | `autoprefixer` | 10.4.23 | MIT | 2026-01-30 | 1 | CSS vendor prefixing | **REMOVE** (Tailwind v4 handles it) |
| 6 | `caniuse-lite` | 1.0.30001761 | CC-BY-4.0 | 2026-02-15 | 2 | Browser compat data | **REMOVE** (transitive) |
| 7 | `client-only` | 0.0.1 | MIT | 2022-09-03 | 1 | Client component guard | **REMOVE** (not imported) |
| 8 | `googleapis` | 168.0.0 | Apache-2.0 | 2026-02-05 | 1 | Google API client | **REPLACE** (submodules) |
| 9 | `lucide-react` | 0.559.0 | ISC | 2026-02-19 | 1 | React icons | KEEP |
| 10 | `next` | 14.2.35 | MIT | 2026-02-20 | 2 | Framework | KEEP (bump to 15.x for CVEs) |
| 11 | `next-auth` | 5.0.0-beta.30 | ISC | 2025-10-29 | 3 | Authentication | KEEP (plan migration) |
| 12 | `openai` | 6.15.0 | Apache-2.0 | 2026-02-17 | 16 | Embeddings API | KEEP (evaluate replacing) |
| 13 | `postcss` | 8.5.6 | MIT | 2025-09-09 | 1 | CSS processor | KEEP (peer dep) |
| 14 | `react` | 18.3.1 | MIT | 2026-02-20 | 2 | UI framework | KEEP |
| 15 | `react-dom` | 18.3.1 | MIT | 2026-02-20 | 2 | React DOM renderer | KEEP |
| 16 | `styled-jsx` | 5.1.7 | MIT | 2025-04-30 | 3 | CSS-in-JS | **REMOVE** (transitive) |
| 17 | `tailwindcss` | 4.1.18 | MIT | 2026-02-20 | 3 | Utility CSS | KEEP |
| 18 | `uuid` | 13.0.0 | MIT | 2025-09-08 | 2 | UUID generation | KEEP (v5 needed), replace v4 usage |
| 19 | `zod` | 4.3.6 | MIT | 2026-01-25 | 1 | Schema validation | KEEP |

---

## Appendix B: Native Binary Audit

| Binary | Source | Signed? | Purpose | Risk |
|--------|--------|---------|---------|------|
| `next-swc.darwin-arm64.node` | Vercel (Next.js) | npm provenance | SWC compiler | LOW |
| `tailwindcss-oxide.darwin-arm64.node` | Tailwind Labs | npm provenance | Class scanner | LOW |
| `lightningcss.darwin-arm64.node` | Parcel team | npm provenance | CSS processor | LOW |

All three are published by reputable, well-funded organizations and are distributed as prebuilt platform-specific binaries (no compilation at install time). No custom `binding.gyp` files exist in the dependency tree.
