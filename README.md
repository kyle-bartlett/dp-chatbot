# Anker Charging Knowledge Hub

AI-powered chatbot for the Anker Demand Planning team. Built with Next.js and Claude AI with RAG (Retrieval Augmented Generation) for intelligent document search.

## Features

- **Professional Chat Interface** - Anker branding with lightning bolt + battery logo
- **Claude AI Backend** - Powered by Claude for intelligent responses
- **Document RAG System** - Feed your docs, get intelligent answers
- **Google Sheets/Docs Integration** - Import directly from Google
- **Manual Content Upload** - Paste from Lark or any source
- **Semantic Search** - Finds relevant information across all documents
- **Source Citations** - Know where answers come from

## Quick Start

### 1. Install dependencies

```bash
cd anker-dp-chatbot
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your API keys:

```bash
# Required for chat
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Required for document search
OPENAI_API_KEY=sk-your-key-here

# Optional: for Google Sheets/Docs import
GOOGLE_API_KEY=your-google-api-key
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Adding Documents

1. Click the **documents icon** (📄) in the header
2. Choose **Google URL** or **Paste Content**
3. Add your SOPs, training docs, CPFR procedures
4. The chatbot will automatically search them when answering

### Supported Sources

- Google Sheets (with Google API key)
- Google Docs (with Google API key)
- Manual paste (Lark, text, any content)

## Project Structure

```
anker-dp-chatbot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/          # Claude + RAG API
│   │   │   └── documents/     # Document management API
│   │   ├── documents/         # Document management page
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js            # Main chat page
│   ├── components/
│   │   ├── ChatInput.jsx
│   │   ├── ChatWindow.jsx
│   │   ├── Logo.jsx
│   │   ├── MessageBubble.jsx
│   │   └── TypingIndicator.jsx
│   └── lib/
│       ├── chunker.js         # Document chunking
│       ├── embeddings.js      # OpenAI embeddings
│       ├── googleApi.js       # Google Sheets/Docs
│       └── vectorStore.js     # Vector search
├── data/                      # Document storage (auto-created)
└── package.json
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `GOOGLE_API_KEY` (optional)
4. Deploy

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API for chat |
| `OPENAI_API_KEY` | For docs | Embeddings for search |
| `GOOGLE_API_KEY` | Optional | Google Sheets/Docs access |

## How It Works

1. **Document Ingestion**: Documents are split into chunks (~1000 chars)
2. **Embedding**: Each chunk is converted to a vector using OpenAI
3. **Storage**: Vectors stored in local JSON (upgradeable to Pinecone)
4. **Query**: User questions are embedded and matched against chunks
5. **Generation**: Relevant chunks sent to Claude for answer generation

## Roadmap

- [x] Professional chat UI with Anker branding
- [x] Claude AI integration
- [x] Document ingestion system
- [x] RAG with semantic search
- [x] Document management page
- [ ] Google OAuth (Anker domain restriction)
- [ ] SKU lookup functionality
- [ ] CPFR forecast integration
- [ ] Lark API integration

## API Costs (Estimated)

| Service | Cost | Notes |
|---------|------|-------|
| Claude API | ~$3/1M tokens | Main chat |
| OpenAI Embeddings | ~$0.02/1M tokens | Very cheap |
| **Monthly estimate** | **~$20-50** | For moderate team use |

## Internal Use Only

This application is for Anker Demand Planning team internal use.
