'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  ArrowLeft,
  MessageSquare,
  FileStack,
  Search,
  Zap,
  Shield,
  BookOpen,
  HelpCircle,
  CheckCircle
} from 'lucide-react'

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'AI Chat Assistant',
    description: 'Ask questions about CPFR, forecasting, KPIs, SOPs, and more. The assistant understands natural language and provides detailed answers.'
  },
  {
    icon: FileStack,
    title: 'Document Knowledge Base',
    description: 'Add your Google Sheets, Docs, or paste content directly. The system indexes your documents for intelligent search.'
  },
  {
    icon: Search,
    title: 'Semantic Search',
    description: 'Questions are matched against your documents using AI embeddings, finding relevant information even with different wording.'
  },
  {
    icon: Zap,
    title: 'SKU Lookup',
    description: 'Search for specific SKUs to find inventory, forecast, and supply information across all loaded documents.'
  },
  {
    icon: Shield,
    title: 'Anker-Only Access',
    description: 'When authentication is enabled, only @anker.com email addresses can access the application.'
  },
  {
    icon: BookOpen,
    title: 'Source Citations',
    description: 'Every answer shows which documents were used, with links back to the original sources.'
  }
]

const TIPS = [
  {
    title: 'Be Specific',
    tip: 'Instead of "How does forecasting work?", try "What is the forecast refresh process for Walmart CPFR?"'
  },
  {
    title: 'Use SKU Numbers',
    tip: 'Include SKU numbers in your questions like "What is the forecast for SKU A2140?"'
  },
  {
    title: 'Add More Documents',
    tip: 'The more documents you load, the better the answers. Add SOPs, training docs, and process guides.'
  },
  {
    title: 'Check Sources',
    tip: 'Click "X sources used" under any answer to see which documents were referenced.'
  },
  {
    title: 'Export Conversations',
    tip: 'Use the Export button to save important conversations for later reference.'
  }
]

const EXAMPLE_QUESTIONS = [
  'What is the CPFR process for Target?',
  'How do I refresh the BBY forecast ladder?',
  'Where can I find the KPI dashboard?',
  'What are the steps for NPI launch forecasting?',
  'Explain the sell-in FC accuracy calculation',
  'What training materials are available for new hires?',
  'How does the PSI ladder work?',
  'What is the trend adjustment rule for forecasts?'
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white/60 via-white/40 to-transparent">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur border-b border-white/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Logo />
          </div>
          <h1 className="text-lg font-semibold text-gray-700">Help & Guide</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#00A0E9] to-[#00d4aa] rounded-2xl mb-4">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            Welcome to Anker Charging Offline Planning Assistant
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Your AI-powered knowledge hub for offline planning. Get instant answers about CPFR, forecasting, SOPs, and more.
          </p>
        </div>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((feature, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#00A0E9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-[#00A0E9]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Tips for Better Results</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {TIPS.map((tip, idx) => (
              <div key={idx} className={`p-4 flex items-start gap-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                <CheckCircle className="w-5 h-5 text-[#00d4aa] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-800">{tip.title}</h3>
                  <p className="text-sm text-gray-500">{tip.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Example Questions */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Example Questions</h2>
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="grid md:grid-cols-2 gap-3">
              {EXAMPLE_QUESTIONS.map((question, idx) => (
                <Link
                  key={idx}
                  href={`/?q=${encodeURIComponent(question)}`}
                  className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-[#00A0E9] hover:text-[#00A0E9] transition-colors"
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{question}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Getting Started</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="w-8 h-8 bg-[#00A0E9] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                <div>
                  <h3 className="font-semibold text-gray-800">Add Your Documents</h3>
                  <p className="text-sm text-gray-500">Go to the <Link href="/documents" className="text-[#00A0E9] hover:underline">Documents</Link> page and add your Google Sheets, Docs, or paste content directly.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="w-8 h-8 bg-[#00A0E9] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                <div>
                  <h3 className="font-semibold text-gray-800">Ask Questions</h3>
                  <p className="text-sm text-gray-500">Return to the <Link href="/" className="text-[#00A0E9] hover:underline">Chat</Link> and start asking questions. The AI will search your documents and provide answers.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="w-8 h-8 bg-[#00A0E9] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                <div>
                  <h3 className="font-semibold text-gray-800">Review Sources</h3>
                  <p className="text-sm text-gray-500">Click "sources used" under any answer to see which documents were referenced. Click the link icon to open the original document.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Need Help */}
        <section className="text-center py-8">
          <p className="text-gray-500 mb-4">
            Need additional help? Contact the planning team or your system administrator.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00A0E9] to-[#00d4aa] text-white rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            Start Chatting
          </Link>
        </section>
      </main>
    </div>
  )
}
