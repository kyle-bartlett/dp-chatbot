# Quick Start Guide - Anker Supply Chain Knowledge Hub

## 🚀 15-Minute Setup

### Prerequisites

- Node.js 18+ installed
- Google Workspace account (@anker.com)
- Supabase account (free tier works)
- API keys for Claude and OpenAI

---

## Step 1: Clone & Install (2 min)

```bash
# Clone the repository
git clone <repo-url>
cd dp-chatbot

# Install dependencies
npm install
```

---

## Step 2: Database Setup (5 min)

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click "New Project"
3. Choose organization and fill in project details
4. Wait for project to be provisioned (~2 min)

### Enable pgvector

1. Go to **Database → Extensions**
2. Search for "vector"
3. Click **Enable** on the pgvector extension

### Run Schema

1. Go to **SQL Editor**
2. Create new query
3. Copy entire contents of `DATABASE_SCHEMA.sql`
4. Paste and click **Run**
5. Verify all tables are created (check green success messages)

### Get Credentials

1. Go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)
3. Save these for next step

---

## Step 3: Google Workspace Setup (5 min)

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Click **+ CREATE CREDENTIALS → OAuth client ID**
4. Application type: **Web application**
5. Name: `Anker Knowledge Hub`
6. Authorized redirect URIs:
   - Add: `http://localhost:3000/api/auth/callback/google`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### Enable Required APIs

1. Go to [Google Cloud Console APIs](https://console.cloud.google.com/apis/library)
2. Search and enable each:
   - **Google Drive API**
   - **Google Sheets API**
   - **Google Docs API**

---

## Step 4: Environment Configuration (2 min)

```bash
# Copy example file
cp .env.local.example .env.local

# Edit the file
nano .env.local  # or use your favorite editor
```

Fill in your credentials:

```bash
# AI APIs
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Get from https://console.anthropic.com
OPENAI_API_KEY=sk-xxxxx         # Get from https://platform.openai.com

# Database (from Step 2)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx

# Google OAuth (from Step 3)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# NextAuth
NEXTAUTH_SECRET=generate-random-string-here  # Or run: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

---

## Step 5: Launch! (1 min)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the login screen!

---

## Step 6: First Time Setup in App

### Sign In

1. Click **Sign in with Google**
2. Use your @anker.com account
3. Grant permissions when prompted

### Set Your Role

1. Click the **⚙️ Settings** icon in header
2. Select your role:
   - Demand Planner
   - Supply Planner
   - Operations
   - GTM
   - Sales
   - Management
3. Select your team context
4. Click **Save**

### Configure Folder Sync

1. Still in Settings, scroll to **Folder Sync**
2. Click **Add Folder**
3. Browse your Google Drive
4. Select a folder containing Sheets/Docs (e.g., "Demand Planning Forecasts")
5. Choose team context for this folder
6. Set sync frequency (Daily recommended)
7. Click **Start Sync**

### Wait for Initial Sync

1. The system will discover all files in the folder
2. Processing starts automatically
3. Check **Sync Status** to see progress
4. Initial sync of 50 files takes ~5-10 minutes

---

## Step 7: Your First Query

Once sync completes, try these:

**For Demand Planners:**
```
"What's in the latest forecast file?"
"Show me SKUs in the Costco CPFR sheet"
"What changed week-over-week?"
```

**For Supply Planners:**
```
"What's in the pipeline tracking sheet?"
"Show me inbound shipments"
```

**General:**
```
"What files do we have synced?"
"Show me the latest updates"
"List all SKUs in the system"
```

---

## 🎉 You're All Set!

### Next Steps

1. **Add more folders** - Sync all your team's Drive folders
2. **Invite team members** - Share the URL with colleagues
3. **Explore features** - Try SKU lookup, context switching
4. **Read examples** - Check [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for query ideas

---

## 🐛 Troubleshooting

### "Failed to sign in"

- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Verify redirect URI in Google Console matches exactly
- Make sure Drive API is enabled

### "No folders found"

- Grant Google Drive permissions during sign-in
- Check OAuth scopes include Drive access
- Re-authenticate by signing out and back in

### "Sync not starting"

- Check Supabase connection (verify credentials)
- Ensure files exist in the selected folder
- Check browser console for errors

### "No search results"

- Wait for files to finish processing
- Check **Settings → Sync Status**
- Verify team context matches file's team tag
- Try a simpler query first

---

## 📚 Learn More

- **[README.md](./README.md)** - Full documentation
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - How it works
- **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** - Query examples
- **[DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)** - Database structure

---

## 💡 Pro Tips

1. **Organize by team** - Use separate Drive folders for each team
2. **Consistent naming** - Name sheets descriptively (e.g., "Costco_Forecast_Q1_2024")
3. **Regular sync** - Set to daily sync for freshest data
4. **Be specific** - Include SKUs, dates, categories in queries
5. **Use context** - Set your role/team for better results

---

## 🆘 Need Help?

- **Technical issues:** Check logs in browser console and Vercel/Supabase dashboards
- **Query help:** See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)
- **Feature requests:** Contact the platform team

Happy chatting! 🚀
