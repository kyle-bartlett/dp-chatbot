'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Table,
  Link as LinkIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  Database,
  FileStack
} from 'lucide-react'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('url') // 'url' or 'manual'
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    try {
      setLoading(true)
      const res = await fetch('/api/documents')
      const data = await res.json()
      setDocuments(data.documents || [])
      setStats(data.stats || null)
    } catch (err) {
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddDocument(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setAdding(true)

    try {
      const body = formType === 'url'
        ? { url, title: title || undefined }
        : { content, title: title || 'Manual Document', type: 'document' }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add document')
      }

      setSuccess(`Added "${data.document.title}" with ${data.chunksCreated} chunks`)
      setShowForm(false)
      setUrl('')
      setTitle('')
      setContent('')
      loadDocuments()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteDocument(doc) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete document')
      }

      setSuccess(`Deleted "${doc.title}"`)
      loadDocuments()
    } catch (err) {
      setError(err.message)
    }
  }

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
          <h1 className="text-lg font-semibold text-gray-700">Document Management</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <FileStack className="w-4 h-4" />
                Documents
              </div>
              <div className="text-2xl font-bold text-gray-800">{stats.totalDocuments}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Database className="w-4 h-4" />
                Chunks
              </div>
              <div className="text-2xl font-bold text-gray-800">{stats.totalChunks}</div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700 text-sm">{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-600">×</button>
          </div>
        )}

        {/* Add Document Button / Form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#00A0E9] to-[#00d4aa] text-white rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Document
          </button>
        ) : (
          <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Document</h2>

            {/* Form type toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setFormType('url')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formType === 'url'
                    ? 'bg-[#00A0E9] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <LinkIcon className="w-4 h-4 inline mr-2" />
                Google URL
              </button>
              <button
                onClick={() => setFormType('manual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formType === 'manual'
                    ? 'bg-[#00A0E9] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Paste Content
              </button>
            </div>

            <form onSubmit={handleAddDocument}>
              {formType === 'url' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google Sheets or Docs URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A0E9]/30 focus:border-[#00A0E9]"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Uses your Anker Google account to access files you have permission to view
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Content
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste your document content here (SOPs, procedures, training materials, etc.)"
                    required
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A0E9]/30 focus:border-[#00A0E9] resize-none"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Walmart CPFR SOP"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A0E9]/30 focus:border-[#00A0E9]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00A0E9] to-[#00d4aa] text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {adding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Document
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setUrl('')
                    setTitle('')
                    setContent('')
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Documents List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Loaded Documents</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-[#00A0E9] animate-spin mx-auto mb-2" />
              <p className="text-gray-500">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center">
              <FileStack className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No documents loaded yet</p>
              <p className="text-sm text-gray-400">
                Add your first document to enable AI-powered search
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <li key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    doc.type === 'spreadsheet'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {doc.type === 'spreadsheet' ? (
                      <Table className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{doc.title}</h3>
                    <p className="text-sm text-gray-500">
                      {doc.type === 'spreadsheet' ? 'Spreadsheet' : 'Document'}
                      {doc.fetchedAt && (
                        <> · Added {new Date(doc.fetchedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>

                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-gray-100 rounded-lg transition-colors"
                      title="Open original"
                    >
                      <LinkIcon className="w-5 h-5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Help text */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-medium text-gray-700 mb-2">Tips for adding documents:</h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• <strong>Google Sheets/Docs:</strong> Any file you can access with your Anker account will work</li>
            <li>• <strong>Paste Content:</strong> Copy-paste from Lark docs or any other source</li>
            <li>• <strong>Best results:</strong> Add SOPs, training docs, CPFR processes, and KPI definitions</li>
            <li>• <strong>Pro tip:</strong> Spreadsheets will have each sheet processed separately for better search</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
