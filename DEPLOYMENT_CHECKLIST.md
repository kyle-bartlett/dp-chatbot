# Deployment Checklist - Anker Supply Chain Knowledge Hub

## 📋 Pre-Deployment Setup

### ☐ 1. Supabase Database

**Create Project:**
- [ ] Sign up at [supabase.com](https://supabase.com)
- [ ] Create new project
- [ ] Wait for provisioning (~2 minutes)

**Enable Extensions:**
- [ ] Go to Database → Extensions
- [ ] Enable `pgvector` extension

**Run Schema:**
- [ ] Go to SQL Editor
- [ ] Copy entire `DATABASE_SCHEMA.sql`
- [ ] Execute (should see green success messages)
- [ ] Verify tables created: documents, document_chunks, structured_data, synced_files, sync_configs, user_preferences

**Get Credentials:**
- [ ] Go to Settings → API
- [ ] Copy Project URL
- [ ] Copy anon/public key
- [ ] Save for environment variables

---

### ☐ 2. Google Cloud Setup

**Create Project:**
- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com)
- [ ] Create new project or select existing
- [ ] Note project ID

**Enable APIs:**
- [ ] Go to APIs & Services → Library
- [ ] Search and enable: **Google Drive API**
- [ ] Search and enable: **Google Sheets API**
- [ ] Search and enable: **Google Docs API**

**Create OAuth Credentials:**
- [ ] Go to APIs & Services → Credentials
- [ ] Click "+ CREATE CREDENTIALS"
- [ ] Choose "OAuth client ID"
- [ ] Application type: Web application
- [ ] Name: `Anker Knowledge Hub`
- [ ] Authorized redirect URIs:
  - [ ] Add: `http://localhost:3000/api/auth/callback/google`
  - [ ] Add: `https://your-domain.vercel.app/api/auth/callback/google`
- [ ] Click Create
- [ ] Copy Client ID and Client Secret

**Configure OAuth Consent Screen:**
- [ ] Go to OAuth consent screen
- [ ] User type: Internal (if G Suite) or External
- [ ] App name: `Anker Supply Chain Knowledge Hub`
- [ ] Add authorized domain: `anker.com`
- [ ] Scopes to add:
  - [ ] `.../auth/userinfo.email`
  - [ ] `.../auth/userinfo.profile`
  - [ ] `.../auth/drive.readonly`
  - [ ] `.../auth/spreadsheets.readonly`
  - [ ] `.../auth/documents.readonly`
- [ ] Save

---

### ☐ 3. AI API Keys

**Anthropic (Claude):**
- [ ] Sign up at [console.anthropic.com](https://console.anthropic.com)
- [ ] Go to API Keys
- [ ] Create new key
- [ ] Copy key (starts with `sk-ant-`)

**OpenAI (Embeddings):**
- [ ] Sign up at [platform.openai.com](https://platform.openai.com)
- [ ] Go to API keys
- [ ] Create new secret key
- [ ] Copy key (starts with `sk-`)

---

### ☐ 4. GitHub Repository

- [ ] Create new repository (or use existing)
- [ ] Initialize Git if needed:
  ```bash
  git init
  git add .
  git commit -m "Initial commit - v2.0.0"
  ```
- [ ] Add remote:
  ```bash
  git remote add origin https://github.com/your-org/dp-chatbot.git
  ```
- [ ] Push code:
  ```bash
  git push -u origin main
  ```

---

## 🚀 Deployment Steps

### ☐ 5. Vercel Deployment

**Import Project:**
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Click "Add New Project"
- [ ] Import from GitHub
- [ ] Select your repository
- [ ] Framework preset: Next.js (auto-detected)

**Configure Build Settings:**
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `.next` (default)
- [ ] Install Command: `npm install` (default)

**Environment Variables:**
Add the following in Vercel dashboard → Settings → Environment Variables:

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

Environment variables checklist:
- [ ] ANTHROPIC_API_KEY
- [ ] OPENAI_API_KEY
- [ ] GOOGLE_CLIENT_ID
- [ ] GOOGLE_CLIENT_SECRET
- [ ] NEXTAUTH_SECRET
- [ ] NEXTAUTH_URL
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY

**Deploy:**
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Note the deployment URL

**Update Google OAuth:**
- [ ] Go back to Google Cloud Console
- [ ] Add Vercel URL to authorized redirect URIs
- [ ] Format: `https://your-domain.vercel.app/api/auth/callback/google`

---

## ✅ Post-Deployment Verification

### ☐ 6. Smoke Tests

**Authentication:**
- [ ] Visit deployed URL
- [ ] Click "Sign in with Google"
- [ ] Verify OAuth consent screen appears
- [ ] Sign in with @anker.com account
- [ ] Verify successful login
- [ ] Check that user name/email appears in header

**Database Connection:**
- [ ] Open browser console (F12)
- [ ] Check for any Supabase errors
- [ ] Try accessing Settings page
- [ ] Verify no database connection errors

**API Routes:**
- [ ] Test chat endpoint: Ask "Hello, are you working?"
- [ ] Verify Claude responds
- [ ] Check that response includes proper formatting

**Google Drive Access:**
- [ ] Go to Settings
- [ ] Try browsing Drive folders (if UI is built)
- [ ] Or test via API: `/api/sync?action=configs`

---

### ☐ 7. Initial Configuration

**First User Setup:**
- [ ] Sign in as admin/first user
- [ ] Go to Settings
- [ ] Set role (e.g., Management for admin)
- [ ] Set team context (e.g., All)
- [ ] Save preferences

**Test Folder Sync:**
- [ ] Create a test folder in Google Drive
- [ ] Add 1-2 test Sheets
- [ ] Configure folder sync via API or UI:
  ```bash
  curl -X POST https://your-domain.vercel.app/api/sync \
    -H "Content-Type: application/json" \
    -d '{"action":"configure","folderId":"YOUR_FOLDER_ID","teamContext":"demand"}'
  ```
- [ ] Trigger sync:
  ```bash
  curl -X POST https://your-domain.vercel.app/api/sync \
    -H "Content-Type: application/json" \
    -d '{"action":"sync","folderId":"YOUR_FOLDER_ID"}'
  ```
- [ ] Process files:
  ```bash
  curl -X POST https://your-domain.vercel.app/api/sync \
    -H "Content-Type: application/json" \
    -d '{"action":"process","limit":5}'
  ```

**Verify Data Ingestion:**
- [ ] Check Supabase dashboard
- [ ] Go to Table Editor → `synced_files`
- [ ] Verify files appear
- [ ] Check `structured_data` table for parsed rows
- [ ] Check `document_chunks` table for embeddings

**Test Queries:**
- [ ] Simple query: "What files do we have?"
- [ ] Structured query: "Show me SKUs in the system"
- [ ] Semantic query: "How do I use this system?"
- [ ] Verify sources are cited correctly

---

## 📊 Monitoring Setup

### ☐ 8. Vercel Analytics

- [ ] Go to Vercel project → Analytics
- [ ] Enable Web Analytics
- [ ] Enable Speed Insights

### ☐ 9. Supabase Monitoring

- [ ] Go to Supabase project → Reports
- [ ] Check Database Health
- [ ] Monitor API usage
- [ ] Set up email alerts for issues

### ☐ 10. API Usage Tracking

**Anthropic (Claude):**
- [ ] Go to [console.anthropic.com](https://console.anthropic.com)
- [ ] Check Usage dashboard
- [ ] Set budget alerts

**OpenAI:**
- [ ] Go to [platform.openai.com](https://platform.openai.com)
- [ ] Check Usage page
- [ ] Set monthly budget limits

**Google Cloud:**
- [ ] Go to APIs & Services → Dashboard
- [ ] Monitor API calls
- [ ] Set quota alerts

---

## 👥 User Onboarding

### ☐ 11. Pilot Users

**Select Initial Users:**
- [ ] 2-3 Demand Planners
- [ ] 2-3 Supply Planners
- [ ] 1-2 Operations
- [ ] 1-2 GTM/Sales
- [ ] 1 Management

**Onboarding Steps:**
- [ ] Send deployment URL
- [ ] Provide quick start guide ([QUICK_START.md](./QUICK_START.md))
- [ ] Schedule 15-min demo/walkthrough
- [ ] Configure their role/team in Settings
- [ ] Help them sync their first folder
- [ ] Share query examples ([USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md))

**Collect Feedback:**
- [ ] Set up feedback form/channel
- [ ] Track common questions
- [ ] Log feature requests
- [ ] Note any bugs/issues

---

## 🔧 Optional Enhancements

### ☐ 12. Custom Domain (Optional)

- [ ] Purchase domain or use subdomain
- [ ] Add domain in Vercel → Settings → Domains
- [ ] Update DNS records
- [ ] Wait for DNS propagation
- [ ] Update NEXTAUTH_URL
- [ ] Update Google OAuth redirect URIs

### ☐ 13. Background Sync Scheduler (Future)

- [ ] Set up Vercel Cron Jobs
- [ ] Or use external scheduler (GitHub Actions, etc.)
- [ ] Schedule daily sync at off-peak hours
- [ ] Monitor sync logs

### ☐ 14. Error Alerting (Recommended)

- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure Slack/email notifications
- [ ] Create oncall rotation

---

## 📝 Documentation for Team

### ☐ 15. Internal Docs

- [ ] Share [QUICK_START.md](./QUICK_START.md) with team
- [ ] Share [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) with team
- [ ] Create internal wiki/notion page
- [ ] Add FAQ based on pilot feedback
- [ ] Document team-specific folder structures

---

## 🎯 Success Criteria

### Metrics to Track

**Technical:**
- [ ] Uptime > 99%
- [ ] Query response time < 3s
- [ ] Sync success rate > 95%
- [ ] Zero authentication errors

**Usage:**
- [ ] > 80% of pilot users active weekly
- [ ] > 50 queries per week
- [ ] > 10 folders synced
- [ ] > 100 files processed

**Quality:**
- [ ] > 80% query satisfaction (via feedback)
- [ ] < 5 bugs reported
- [ ] < 10% "no results found" rate

---

## 🚨 Rollback Plan

**If Critical Issues Arise:**

1. **Disable Auth (Emergency Only):**
   - Comment out AuthGuard in pages
   - Redeploy

2. **Rollback to Previous Version:**
   - Go to Vercel → Deployments
   - Find previous working deployment
   - Click "Promote to Production"

3. **Database Rollback:**
   - Supabase auto-backups daily
   - Go to Database → Backups
   - Restore if needed

4. **Communication:**
   - Notify all active users
   - Post status in team channel
   - Provide ETA for fix

---

## ✅ Final Checklist

Before announcing to full team:

- [ ] All smoke tests passed
- [ ] Pilot users successfully onboarded
- [ ] No critical bugs reported
- [ ] Documentation complete and shared
- [ ] Monitoring dashboards set up
- [ ] API budgets configured
- [ ] Support channel established
- [ ] Feedback mechanism in place

---

## 🎉 Launch!

**Ready to Go Live:**
1. [ ] Announce in team channel
2. [ ] Send email with quick start guide
3. [ ] Schedule team demo session
4. [ ] Monitor closely for first 48 hours
5. [ ] Iterate based on feedback

---

**Deployment Date:** _________________

**Deployed By:** _________________

**Production URL:** _________________

**Status:** ☐ Staging ☐ Production

---

## 📞 Support Contacts

**Technical Issues:**
- Platform Team: _________________
- On-call Engineer: _________________

**Google Workspace:**
- IT Admin: _________________

**Questions/Feedback:**
- Slack Channel: _________________
- Email: _________________
