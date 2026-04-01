import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2, Check, X, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

// XSS sanitization helper
const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface LeadSource {
  id: number
  name: string
}

interface SourceState extends LeadSource {
  isEditing: boolean
  localChanges: { name: string }
}

export function LeadSources() {
  const [sourcesMap, setSourcesMap] = useState<Map<number, SourceState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Map<number, { msg: string; type: 'success' | 'error' }>>(new Map())
  const [validationError, setValidationError] = useState('')

  const fetchSources = useCallback(async () => {
    try {
      const data = await api.get('/settings/sources')
      const safeData: LeadSource[] = Array.isArray(data) ? data : []
      const map = new Map<number, SourceState>()
      safeData.forEach(s => {
        map.set(s.id, {
          ...s,
          isEditing: false,
          localChanges: { name: s.name }
        })
      })
      setSourcesMap(map)
    } catch (err) {
      console.error('Failed to fetch sources:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  const showFeedback = useCallback((id: number, msg: string, type: 'success' | 'error') => {
    setFeedback(prev => {
      const next = new Map(prev)
      next.set(id, { msg, type })
      return next
    })
    setTimeout(() => {
      setFeedback(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, 3000)
  }, [])

  const startEdit = useCallback((id: number) => {
    setSourcesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: true,
          localChanges: { name: item.name }
        })
      }
      return next
    })
  }, [])

  const cancelEdit = useCallback((id: number) => {
    setSourcesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: false,
          localChanges: { name: item.name }
        })
      }
      return next
    })
    setValidationError('')
  }, [])

  const updateLocal = useCallback((id: number, value: string) => {
    setSourcesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          localChanges: { name: value }
        })
      }
      return next
    })
    setValidationError('')
  }, [])

  const saveEdit = useCallback(async (id: number) => {
    const item = sourcesMap.get(id)
    if (!item) return

    const trimmedName = item.localChanges.name.trim()
    if (!trimmedName) {
      setValidationError('Name is required')
      return
    }

    setSaving(id)
    setValidationError('')
    try {
      await api.put(`/settings/sources/${id}`, { name: trimmedName })
      setSourcesMap(prev => {
        const next = new Map(prev)
        next.set(id, {
          ...item,
          name: trimmedName,
          isEditing: false,
          localChanges: { name: trimmedName }
        })
        return next
      })
      showFeedback(id, 'Saved!', 'success')
    } catch (err) {
      console.error('Failed to save:', err)
      showFeedback(id, 'Failed to save', 'error')
      // Rollback
      setSourcesMap(prev => {
        const next = new Map(prev)
        const orig = next.get(id)
        if (orig) {
          next.set(id, {
            ...orig,
            localChanges: { name: orig.name }
          })
        }
        return next
      })
    } finally {
      setSaving(null)
    }
  }, [sourcesMap, showFeedback])

  const deleteSource = useCallback(async (id: number) => {
    if (!window.confirm('Delete this source?')) return
    try {
      await api.del(`/settings/sources/${id}`)
      setSourcesMap(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      showFeedback(id, 'Deleted!', 'success')
    } catch (err) {
      console.error('Failed to delete:', err)
      showFeedback(id, 'Failed to delete', 'error')
    }
  }, [showFeedback])

  const handleAdd = async () => {
    const trimmedName = newItem.trim()
    if (!trimmedName) {
      setValidationError('Name is required')
      return
    }
    setSaving(-1)
    setValidationError('')
    try {
      const created: LeadSource = await api.post('/settings/sources', { name: trimmedName })
      setSourcesMap(prev => {
        const next = new Map(prev)
        next.set(created.id, {
          ...created,
          isEditing: false,
          localChanges: { name: created.name }
        })
        return next
      })
      setNewItem('')
      setIsAdding(false)
      showFeedback(-1, 'Source added!', 'success')
    } catch (err) {
      console.error('Failed to add:', err)
      setValidationError('Failed to add source')
    } finally {
      setSaving(null)
    }
  }

  const handleCancelAdd = () => {
    setIsAdding(false)
    setNewItem('')
    setValidationError('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  const sources = Array.from(sourcesMap.values())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lead Sources</h2>
          <p className="text-sm text-slate-500">Manage where your leads come from</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="btn-primary flex items-center gap-2"
          disabled={isAdding}
        >
          <Plus className="w-4 h-4" />
          Add Source
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {sources.map((source) => (
            <motion.div
              key={source.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="card p-4"
            >
              {source.isEditing ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={source.localChanges.name}
                      onChange={(e) => updateLocal(source.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(source.id)
                        if (e.key === 'Escape') cancelEdit(source.id)
                      }}
                      className={`w-full px-3 py-2 border rounded-xl pr-20 ${
                        validationError && source.localChanges.name.trim() === ''
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-slate-200 focus:border-amber-500'
                      }`}
                      autoFocus
                    />
                    {validationError && source.localChanges.name.trim() === '' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationError}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => saveEdit(source.id)}
                    disabled={saving === source.id || !source.localChanges.name.trim()}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    {saving === source.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => cancelEdit(source.id)}
                    disabled={saving === source.id}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-medium text-slate-900">{escapeHtml(source.name)}</span>

                  {/* Feedback inline */}
                  {feedback.get(source.id) && (
                    <span className={`text-xs font-medium ${
                      feedback.get(source.id)!.type === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {feedback.get(source.id)!.msg}
                    </span>
                  )}

                  <button
                    onClick={() => startEdit(source.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSource(source.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card p-4 border-2 border-amber-200"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => {
                    setNewItem(e.target.value)
                    setValidationError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newItem.trim()) handleAdd()
                    if (e.key === 'Escape') handleCancelAdd()
                  }}
                  placeholder="Source name"
                  className={`w-full px-3 py-2 border rounded-xl pr-20 ${
                    validationError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-amber-500'
                  }`}
                  autoFocus
                />
                {validationError && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationError}
                  </span>
                )}
              </div>
              <button
                onClick={handleAdd}
                disabled={saving === -1 || !newItem.trim()}
                className="btn-primary text-sm flex items-center gap-1"
              >
                {saving === -1 ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add
              </button>
              <button
                onClick={handleCancelAdd}
                disabled={saving === -1}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sources.length === 0 && !isAdding && (
        <div className="text-center py-12 text-slate-400">
          <p>No lead sources yet. Add your first source above.</p>
        </div>
      )}
    </div>
  )
}
