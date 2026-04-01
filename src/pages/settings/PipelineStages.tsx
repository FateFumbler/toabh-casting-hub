import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Check, X, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

export interface PipelineStage {
  id: number
  name: string
  color: string
}

interface StageState extends PipelineStage {
  isEditing: boolean
  localChanges: { name: string; color: string }
}

export function PipelineStages() {
  const [stagesMap, setStagesMap] = useState<Map<number, StageState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState({ name: '', color: '#6366f1' })
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Map<number, { msg: string; type: 'success' | 'error' }>>(new Map())
  const [validationError, setValidationError] = useState('')

  const fetchStages = useCallback(async () => {
    try {
      const data: PipelineStage[] = await api.get('/settings/pipeline')
      const map = new Map<number, StageState>()
      data.forEach(s => {
        map.set(s.id, {
          ...s,
          isEditing: false,
          localChanges: { name: s.name, color: s.color }
        })
      })
      setStagesMap(map)
    } catch (err) {
      console.error('Failed to fetch stages:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  // Auto-hide feedback after 3 seconds
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
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: true,
          localChanges: { name: item.name, color: item.color }
        })
      }
      return next
    })
  }, [])

  const cancelEdit = useCallback((id: number) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: false,
          localChanges: { name: item.name, color: item.color }
        })
      }
      return next
    })
    setValidationError('')
  }, [])

  const updateLocal = useCallback((id: number, field: 'name' | 'color', value: string) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          localChanges: { ...item.localChanges, [field]: value }
        })
      }
      return next
    })
    if (field === 'name') setValidationError('')
  }, [])

  const saveEdit = useCallback(async (id: number) => {
    const item = stagesMap.get(id)
    if (!item) return

    const trimmedName = item.localChanges.name.trim()
    if (!trimmedName) {
      setValidationError('Name is required')
      return
    }

    setSaving(id)
    setValidationError('')
    try {
      await api.put(`/settings/pipeline/${id}`, {
        name: trimmedName,
        color: item.localChanges.color
      })
      setStagesMap(prev => {
        const next = new Map(prev)
        next.set(id, {
          ...item,
          name: trimmedName,
          color: item.localChanges.color,
          isEditing: false,
          localChanges: { name: trimmedName, color: item.localChanges.color }
        })
        return next
      })
      showFeedback(id, 'Saved!', 'success')
    } catch (err) {
      console.error('Failed to save:', err)
      showFeedback(id, 'Failed to save', 'error')
      // Rollback localChanges to original
      setStagesMap(prev => {
        const next = new Map(prev)
        const orig = next.get(id)
        if (orig) {
          next.set(id, {
            ...orig,
            localChanges: { name: orig.name, color: orig.color }
          })
        }
        return next
      })
    } finally {
      setSaving(null)
    }
  }, [stagesMap, showFeedback])

  const deleteStage = useCallback(async (id: number) => {
    if (!window.confirm('Delete this stage?')) return
    try {
      await api.del(`/settings/pipeline/${id}`)
      setStagesMap(prev => {
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
    const trimmedName = newItem.name.trim()
    if (!trimmedName) {
      setValidationError('Name is required')
      return
    }
    setSaving(-1)
    setValidationError('')
    try {
      const created: PipelineStage = await api.post('/settings/pipeline', {
        name: trimmedName,
        color: newItem.color
      })
      setStagesMap(prev => {
        const next = new Map(prev)
        next.set(created.id, {
          ...created,
          isEditing: false,
          localChanges: { name: created.name, color: created.color }
        })
        return next
      })
      setNewItem({ name: '', color: '#6366f1' })
      setIsAdding(false)
      showFeedback(-1, 'Stage added!', 'success')
    } catch (err) {
      console.error('Failed to add:', err)
      setValidationError('Failed to add stage')
    } finally {
      setSaving(null)
    }
  }

  const handleCancelAdd = () => {
    setIsAdding(false)
    setNewItem({ name: '', color: '#6366f1' })
    setValidationError('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  const stages = Array.from(stagesMap.values())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pipeline Stages</h2>
          <p className="text-sm text-slate-500">Manage your casting pipeline stages</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="btn-primary flex items-center gap-2"
          disabled={isAdding}
        >
          <Plus className="w-4 h-4" />
          Add Stage
        </button>
      </div>

      {/* Stages List */}
      <div className="space-y-2">
        <AnimatePresence>
          {stages.map((stage, index) => (
            <motion.div
              key={stage.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="card p-4"
            >
              {stage.isEditing ? (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={stage.localChanges.color}
                    onChange={(e) => updateLocal(stage.id, 'color', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={stage.localChanges.name}
                      onChange={(e) => updateLocal(stage.id, 'name', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(stage.id)
                        if (e.key === 'Escape') cancelEdit(stage.id)
                      }}
                      className={`w-full px-3 py-2 border rounded-xl pr-20 ${
                        validationError && stage.localChanges.name.trim() === '' 
                          ? 'border-red-400 focus:border-red-500' 
                          : 'border-slate-200 focus:border-amber-500'
                      }`}
                      autoFocus
                    />
                    {validationError && stage.localChanges.name.trim() === '' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationError}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => saveEdit(stage.id)}
                    disabled={saving === stage.id || !stage.localChanges.name.trim()}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    {saving === stage.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => cancelEdit(stage.id)}
                    disabled={saving === stage.id}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {}}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={() => {}}
                      disabled={index === stages.length - 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="flex-1 font-medium text-slate-900">{stage.name}</span>

                  {/* Feedback inline */}
                  {feedback.get(stage.id) && (
                    <span className={`text-xs font-medium ${
                      feedback.get(stage.id)!.type === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {feedback.get(stage.id)!.msg}
                    </span>
                  )}

                  <button
                    onClick={() => startEdit(stage.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteStage(stage.id)}
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

      {/* Add New Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card p-4 border-2 border-amber-200"
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newItem.color}
                onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
              />
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => {
                    setNewItem({ ...newItem, name: e.target.value })
                    setValidationError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newItem.name.trim()) handleAdd()
                    if (e.key === 'Escape') handleCancelAdd()
                  }}
                  placeholder="Stage name"
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
                disabled={saving === -1 || !newItem.name.trim()}
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

      {stages.length === 0 && !isAdding && (
        <div className="text-center py-12 text-slate-400">
          <p>No pipeline stages yet. Add your first stage above.</p>
        </div>
      )}
    </div>
  )
}
