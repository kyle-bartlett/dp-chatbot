# Anker Supply Chain Knowledge Hub

**AI-Powered Cross-Functional Knowledge Assistant** for the entire supply chain organization. Built with Next.js 14, Claude AI, and live Google Workspace integration.

## 🎯 Purpose

This isn't just a demand planning chatbot—it's a comprehensive knowledge hub for:

- ✅ **Demand & Supply Planners** - Forecasts, CPFR, week-over-week analysis
- ✅ **Operations** - Pipeline tracking, inbound ETAs, logistics
- ✅ **GTM Teams** - Launch tracking, retail coverage, campaigns
- ✅ **Sales** - Account management, revenue pipelines
- ✅ **Management** - Summary dashboards, risk reports, KPIs

**All with live Google Sheets/Docs sync and natural language queries.**

## 🚀 Key Features

### 🔄 Live Google Workspace Integration
- **Native Drive API access** - No more manual uploads
- **Folder-based sync** - Automatically discover and index files
- **Background sync** - Hourly/daily updates from shared folders
- **Team-based organization** - Files tagged by team/project/folder

### 🧠 Hybrid RAG Engine
- **Structured reasoning** - Query Google Sheets data (forecasts, pipeline, inventory)
- **Semantic search** - Natural language queries across SOPs, docs, comments
- **Intelligent routing** - Automatically detects query type and searches accordingly
- **Context-aware answers** - Results filtered by team and role

### 👥 Multi-Role Support
- **Role-based context** - Demand planner, supply planner, ops, GTM, sales, management
- **Team filtering** - See only relevant files and data for your team
- **Context switching** - Easily switch between team contexts
- **Personalized responses** - Answers tailored to your role

### 📊 Smart Retrieval
- **Week-over-week analysis** - Track forecast changes automatically
- **SKU lookup** - Find any ASIN or product code instantly
- **Cross-file search** - Answers that span multiple sheets and docs
- **Source citations** - Always know where information came from

## Quick Start

### 1. Install dependencies

```bash
cd anker-dp-chatbot
npm install
```

### 2. Set up Supabase Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the database setup script (see `Database Schema` section below)
3. Enable pgvector extension in Supabase dashboard

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Authentication (Google OAuth for @anker.com domain)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI APIs
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Required for chat
OPENAI_API_KEY=sk-your-key-here          # Required for embeddings
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📂 Setting Up Folder Sync

### Initial Setup

1. **Sign in** with your @anker.com Google account
2. **Navigate to Settings** (⚙️ icon)
3. **Set your role and team context**
   - Role: Demand Planner, Supply Planner, Operations, GTM, Sales, or Management
   - Team: Your primary team/department
4. **Configure folder sync**
   - Go to "Sync Folders" section
   - Browse your Google Drive
   - Select folders to sync (e.g., "Demand Planning Forecasts", "Pipeline Data")
   - Set sync frequency (hourly, daily, weekly)
   - Assign team context to each folder

### How Sync Works

1. **Folder Discovery** - System lists all Sheets and Docs in selected folders
2. **Metadata Tracking** - Files are tracked with modification dates, owners, paths
3. **Background Sync** - New/updated files are detected automatically
4. **Content Processing**:
   - **Sheets** → Structured data + searchable chunks
   - **Docs** → Semantic embeddings for natural language search
5. **Team Tagging** - Files are tagged with team context for filtered search

### Supported File Types

- ✅ **Google Sheets** - Forecasts, pipeline, inventory, tracking, CPFR
- ✅ **Google Docs** - SOPs, training guides, meeting notes, procedures
- ✅ **Comments** - Planner comments embedded in sheets (future feature)

## 🏗️ Architecture

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind 4 |
| **Auth** | NextAuth with Google OAuth (@anker.com domain) |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **AI/LLM** | Claude (Anthropic) for chat, OpenAI for embeddings |
| **APIs** | Google Drive API, Sheets API, Docs API |
| **Deployment** | Vercel (frontend), Supabase (database) |

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                      User Interface                      │
│  (Chat, Settings, Folder Browser, Context Switcher)     │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │   Next.js API Routes │
          └──────────┬───────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
│  Hybrid   │  │  Drive  │  │   Context   │
│ Retrieval │  │  Sync   │  │  Manager    │
└─────┬─────┘  └────┬────┘  └──────┬──────┘
      │             │              │
┌─────┴──────┬──────┴──────┬───────┴──────┐
│ Structured │   Semantic  │  User Prefs  │
│   Store    │    Store    │    Store     │
│ (Sheets)   │   (Docs)    │ (Roles)      │
└────────────┴─────────────┴──────────────┘
             Supabase Database
```

## 📁 Project Structure

```
dp-chatbot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── chat/          # Claude + Hybrid RAG
│   │   │   ├── context/       # User role/team management
│   │   │   ├── documents/     # Manual document upload
│   │   │   ├── import/        # Folder import/sync
│   │   │   ├── sku/           # SKU lookup
│   │   │   └── sync/          # Background sync engine
│   │   ├── documents/         # Document management page
│   │   ├── settings/          # User settings & sync config
│   │   ├── help/              # Help & onboarding
│   │   └── page.js            # Main chat interface
│   ├── components/            # UI components
│   │   ├── ChatWindow.jsx
│   │   ├── ChatInput.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── RoleSelector.jsx   # (to be created)
│   │   └── SyncStatus.jsx     # (to be created)
│   └── lib/
│       ├── auth.js            # NextAuth config
│       ├── chunker.js         # Document chunking
│       ├── driveSync.js       # ✨ NEW: Drive folder sync
│       ├── embeddings.js      # OpenAI embeddings
│       ├── googleApi.js       # Google Sheets/Docs API
│       ├── hybridRetrieval.js # ✨ NEW: Hybrid search engine
│       ├── structuredProcessor.js # ✨ NEW: Sheets processor
│       ├── supabaseClient.js  # Supabase connection
│       ├── vectorStore.js     # Vector search
│       └── skuLookup.js       # SKU search
└── package.json
```

## 📊 Database Setup

### Supabase Configuration

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Enable pgvector extension:**
   - Go to Database → Extensions
   - Search for "vector"
   - Enable the pgvector extension

3. **Run the schema:**
   - Go to SQL Editor
   - Copy contents of `DATABASE_SCHEMA.sql`
   - Execute the script

4. **Get your credentials:**
   - Go to Settings → API
   - Copy the Project URL and anon/public key
   - Add to `.env.local`

### Google Workspace Setup

1. **Create OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create a new OAuth 2.0 Client ID (Web application)
   
2. **Enable required APIs:**
   - Google Drive API
   - Google Sheets API
   - Google Docs API

3. **Configure OAuth consent screen:**
   - User type: Internal (for G Suite) or External
   - Add authorized domain: `anker.com`
   - Scopes needed:
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/spreadsheets.readonly`
     - `https://www.googleapis.com/auth/documents.readonly`

4. **Add redirect URIs:**
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure environment variables:**
   
   In Vercel dashboard → Settings → Environment Variables, add:
   
   ```
   ANTHROPIC_API_KEY
   OPENAI_API_KEY
   GOOGLE_CLIENT_ID
   GOOGLE_CLIENT_SECRET
   NEXTAUTH_SECRET
   NEXTAUTH_URL
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. **Deploy**
   - Vercel will automatically deploy
   - Updates push automatically on Git commits

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Claude API for chat responses |
| `OPENAI_API_KEY` | ✅ Yes | Embeddings for semantic search |
| `GOOGLE_CLIENT_ID` | ✅ Yes | OAuth authentication + Drive API |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | OAuth authentication |
| `NEXTAUTH_SECRET` | ✅ Yes | NextAuth session encryption |
| `NEXTAUTH_URL` | ✅ Yes | Your app URL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase public API key |

## 🔧 How It Works

### The Magic Behind the Scenes

1. **🔐 Authentication**
   - User signs in with @anker.com Google account
   - OAuth grants access to Drive, Sheets, Docs APIs
   - Session created with access token

2. **📂 Folder Sync**
   - User selects Drive folders to monitor
   - System recursively discovers all Sheets/Docs
   - Metadata tracked (name, modified date, owner, path)
   - Background sync detects new/updated files

3. **📊 Dual Processing**
   - **Sheets** → Parsed into structured database records (SKU, forecast, dates, numbers)
   - **Docs** → Chunked into ~1000 char segments, embedded with OpenAI
   - Both indexed for fast retrieval

4. **🔍 Intelligent Search**
   - Query analyzed for intent (structured vs semantic)
   - **Structured search** → SQL queries on sheet data
   - **Semantic search** → Vector similarity on document chunks
   - Results combined and ranked

5. **🧠 Answer Generation**
   - Retrieved context formatted for Claude
   - Role-based prompt engineering
   - Claude generates human-friendly answer
   - Sources cited with links

---

## 💰 Cost Estimate

| Service | Usage | Cost | Notes |
|---------|-------|------|-------|
| **Claude API** | ~1M tokens/month | ~$3-8 | Chat responses |
| **OpenAI Embeddings** | ~5M tokens/month | ~$0.10 | Very cheap |
| **Supabase** | Hobby tier | Free-$25 | Scales with data |
| **Vercel** | Hobby tier | Free-$20 | Scales with traffic |
| **Total** | Moderate use | **$3-50/month** | Scales with team size |

> **Note:** Costs scale with usage. Heavy teams may need higher tiers.

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture
- **[DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)** - Complete database schema
- **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** - Query examples by role
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - UI/UX guidelines

---

## 🎯 Roadmap

### ✅ Completed (v1.0)
- [x] Professional chat UI with Anker branding
- [x] Claude AI integration
- [x] Google OAuth (@anker.com domain)
- [x] Supabase database with pgvector
- [x] Hybrid RAG (structured + semantic)
- [x] Google Drive folder sync
- [x] Multi-role support
- [x] SKU lookup functionality
- [x] Team context filtering

### 🚧 In Progress (v1.1)
- [ ] Background sync scheduler
- [ ] Real-time sync status dashboard
- [ ] Enhanced settings UI for folder management
- [ ] Role selector component in chat
- [ ] Week-over-week analysis UI

### 🔮 Planned (v2.0)
- [ ] Drive webhooks (real-time file change notifications)
- [ ] Planner comments extraction from Sheets
- [ ] Excel file upload support
- [ ] Advanced analytics dashboard
- [ ] Slack/Teams integration
- [ ] Mobile app

---

## 🛟 Support & Troubleshooting

### Common Issues

**Problem:** "Authentication failed"
- **Solution:** Check Google OAuth credentials, ensure redirect URIs match

**Problem:** "No documents found"
- **Solution:** Configure folder sync in Settings, wait for processing

**Problem:** "Search returns no results"
- **Solution:** Check team context filter, verify files are synced

**Problem:** "Slow responses"
- **Solution:** Check API rate limits, database indexes, Supabase plan

### Getting Help

For internal support:
- Check [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for query tips
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system details
- Contact the platform team for technical issues

---

## 🔒 Security & Privacy

- ✅ **Domain-restricted** - Only @anker.com accounts
- ✅ **OAuth-based** - No password storage
- ✅ **Encrypted** - All data encrypted at rest (Supabase)
- ✅ **Private** - Data never leaves your control
- ✅ **Auditable** - All queries logged
- ✅ **Compliant** - Follows Google Workspace security policies

---

## 📄 License

**Proprietary** - For internal Anker use only.

This application contains confidential business information and is not for public distribution.
