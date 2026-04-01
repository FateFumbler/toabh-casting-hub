import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Check, X, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

export interface PipelineStage {
  id: number
  name: string
  color: string
  sort_order?: number
}

interface StageState extends PipelineStage {
  isEditing: boolean
  localName: string
  localColor: string
  // Pending save flag to prevent rapid double-clicks
  pending?: boolean
}

// XSS sanitization helper
const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: derive sorted list from map
// ─────────────────────────────────────────────────────────────────────────────
const toList = (map: Map<number, StageState>): StageState[] =>
  Array.from(map.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function PipelineStages() {
  // Single source of truth
  const [stagesMap, setStagesMap] = useState<Map<number, StageState>>(new Map())

  // Derived: always computed from stagesMap, never kept as separate state
  const stages = toList(stagesMap)

  const [loading, setLoading] = useState(true)

  // Add-new form
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')

  // Shared add-in-progress guard (uses ref to avoid stale closure in async handlers)
  const addingRef = useRef(false)

  // Per-item saving guard (stage id → true while request is in flight)
  const [savingSet, setSavingSet] = useState<Set<number>>(new Set())

  // Per-item feedback messages
  const [feedback, setFeedback] = useState<Map<number, { msg: string; type: 'success' | 'error' }>>(new Map())

  // Global validation error for the add form
  const [addError, setAddError] = useState('')

  // ─────────────────────────────────────────────────────────────────────────
  // Load
  // ─────────────────────────────────────────────────────────────────────────
  const fetchStages = useCallback(async () => {
    try {
      const data: PipelineStage[] = await api.get('/settings/pipeline')
      const map = new Map<number, StageState>()
      data.forEach((s, idx) => {
        map.set(s.id, {
          ...s,
          sort_order: s.sort_order ?? idx,
          isEditing: false,
          localName: s.name,
          localColor: s.color,
        })
      })
      setStagesMap(map)
    } catch (err) {
      console.error('Failed to fetch stages:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStages() }, [fetchStages])

  // ─────────────────────────────────────────────────────────────────────────
  // Feedback helper (auto-clears after 3s)
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Optimistic update helper — updates map then calls API
  // ─────────────────────────────────────────────────────────────────────────
  const withOptimisticUpdate = useCallback(async <T,>(
    id: number,
    optimisticUpdate: (map: Map<number, StageState>) => Map<number, StageState>,
    apiCall: () => Promise<T>,
    onSuccess?: (result: T, map: Map<number, StageState>) => void,
  ) => {
    // Optimistic
    setStagesMap(prev => optimisticUpdate(new Map(prev)))
    setSavingSet(prev => new Set(prev).add(id))
    try {
      const result = await apiCall()
      setStagesMap(prev => {
        const next = optimisticUpdate(new Map(prev)) // re-apply with confirmed data
        onSuccess?.(result, next)
        return next
      })
      return { ok: true, result }
    } catch (err) {
      // Rollback: re-fetch to get server truth
      await fetchStages()
      showFeedback(id, 'Action failed — reverted', 'error')
      return { ok: false, error: err }
    } finally {
      setSavingSet(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [fetchStages, showFeedback])

  // ─────────────────────────────────────────────────────────────────────────
  // Reorder: move up
  // ─────────────────────────────────────────────────────────────────────────
  const moveUp = async (index: number) => {
    if (index === 0) return
    const list = toList(stagesMap)
    const reordered = [...list]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]

    // Persist sort_order values
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    const newMap = new Map(withOrder.map(s => [s.id, s]))
    setStagesMap(newMap)

    try {
      await api.put('/settings/pipeline/reorder', {
        stages: withOrder.map(s => ({ id: s.id, name: s.localName, color: s.localColor, sort_order: s.sort_order }))
      })
    } catch (err) {
      console.error('Reorder failed:', err)
      await fetchStages()
      showFeedback(-1, 'Reorder failed', 'error')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reorder: move down
  // ─────────────────────────────────────────────────────────────────────────
  const moveDown = async (index: number) => {
    const list = toList(stagesMap)
    if (index >= list.length - 1) return
    const reordered = [...list]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]

    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    const newMap = new Map(withOrder.map(s => [s.id, s]))
    setStagesMap(newMap)

    try {
      await api.put('/settings/pipeline/reorder', {
        stages: withOrder.map(s => ({ id: s.id, name: s.localName, color: s.localColor, sort_order: s.sort_order }))
      })
    } catch (err) {
      console.error('Reorder failed:', err)
      await fetchStages()
      showFeedback(-1, 'Reorder failed', 'error')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Start editing — populates localName/localColor from current values
  // ─────────────────────────────────────────────────────────────────────────
  const startEdit = useCallback((id: number) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: true,
          localName: item.name,
          localColor: item.color,
        })
      }
      return next
    })
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Update local field while editing (no API call)
  // ─────────────────────────────────────────────────────────────────────────
  const updateLocal = useCallback((id: number, field: 'name' | 'color', value: string) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          [field === 'name' ? 'localName' : 'localColor']: value,
        })
      }
      return next
    })
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Cancel editing — restore original name/color
  // ─────────────────────────────────────────────────────────────────────────
  const cancelEdit = useCallback((id: number) => {
    setStagesMap(prev => {
      const next = new Map(prev)
      const item = next.get(id)
      if (item) {
        next.set(id, {
          ...item,
          isEditing: false,
          localName: item.name,   // restore original
          localColor: item.color, // restore original
        })
      }
      return next
    })
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Save edit
  // ─────────────────────────────────────────────────────────────────────────
  const saveEdit = async (id: number) => {
    const item = stagesMap.get(id)
    if (!item) return

    const trimmedName = item.localName.trim()
    if (!trimmedName) return

    // Duplicate-name guard (across all stages)
    const duplicate = Array.from(stagesMap.values()).find(
      s => s.id !== id && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      showFeedback(id, `"${trimmedName}" already exists`, 'error')
      return
    }

    const { ok } = await withOptimisticUpdate(
      id,
      map => {
        const next = new Map(map)
        const s = next.get(id)
        if (s) next.set(id, { ...s, isEditing: false })
        return next
      },
      async () => {
        const updated: PipelineStage = await api.put(`/settings/pipeline/${id}`, {
          name: trimmedName,
          color: item.localColor,
        })
        return updated
      },
      (_result, nextMap) => {
        // Apply server-confirmed values to local fields
        const s = nextMap.get(id)
        if (s) {
          setStagesMap(prev => {
            const next = new Map(prev)
            next.set(id, { ...s, name: s.localName, color: s.localColor })
            return next
          })
        }
        showFeedback(id, 'Saved!', 'success')
      }
    )
    if (ok) {
      // sync local fields with confirmed name/color
      setStagesMap(prev => {
        const next = new Map(prev)
        const s = next.get(id)
        if (s) next.set(id, { ...s, name: s.localName, color: s.localColor })
        return next
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────────────────
  const deleteStage = useCallback(async (id: number) => {
    if (!window.confirm('Delete this stage?')) return

    const item = stagesMap.get(id)
    const name = item?.name ?? ''

    // Optimistic: remove from map
    setStagesMap(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setSavingSet(prev => new Set(prev).add(id))

    try {
      await api.del(`/settings/pipeline/${id}`)
      showFeedback(id, `"${name}" deleted`, 'success')
    } catch (err) {
      console.error('Delete failed:', err)
      await fetchStages() // rollback
      showFeedback(id, 'Delete failed — reverted', 'error')
    } finally {
      setSavingSet(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [stagesMap, fetchStages, showFeedback])

  // ─────────────────────────────────────────────────────────────────────────
  // Add new stage
  // ─────────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmedName = newName.trim()
    if (!trimmedName) {
      setAddError('Name is required')
      return
    }

    // Duplicate-name guard
    const duplicate = Array.from(stagesMap.values()).find(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      setAddError(`"${trimmedName}" already exists`)
      return
    }

    if (addingRef.current) return
    addingRef.current = true
    setSavingSet(prev => new Set(prev).add(-1))

    const color = newColor
    const sort_order = stages.length // append at end

    try {
      const created: PipelineStage = await api.post('/settings/pipeline', {
        name: trimmedName,
        color,
      })

      setStagesMap(prev => {
        const next = new Map(prev)
        next.set(created.id, {
          ...created,
          sort_order,
          isEditing: false,
          localName: created.name,
          localColor: created.color,
        })
        return next
      })

      setNewName('')
      setNewColor('#6366f1')
      setIsAdding(false)
      setAddError('')
      showFeedback(-1, `"${trimmedName}" added!`, 'success')
    } catch (err) {
      console.error('Add failed:', err)
      setAddError('Failed to add stage')
    } finally {
      addingRef.current = false
      setSavingSet(prev => {
        const next = new Set(prev)
        next.delete(-1)
        return next
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cancel add form
  // ─────────────────────────────────────────────────────────────────────────
  const handleCancelAdd = () => {
    if (addingRef.current) return
    setIsAdding(false)
    setNewName('')
    setNewColor('#6366f1')
    setAddError('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pipeline Stages</h2>
          <p className="text-sm text-slate-500">Manage your casting pipeline stages</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Stage
        </button>
      </div>

      {/* Stages list */}
      <div className="space-y-2">
        <AnimatePresence>
          {stages.map((stage, index) => {
            const isSaving = savingSet.has(stage.id)
            const fb = feedback.get(stage.id)

            return (
              <motion.div
                key={stage.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="card p-4"
              >
                {/* ── Editing row ──────────────────────────────────────── */}
                {stage.isEditing ? (
                  <div className="flex items-center gap-3">
                    {/* Color picker */}
                    <input
                      type="color"
                      value={stage.localColor}
                      onChange={e => updateLocal(stage.id, 'color', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                    />

                    {/* Name input */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={stage.localName}
                        onChange={e => {
                          updateLocal(stage.id, 'name', e.target.value)
                          setFeedback(prev => { const n = new Map(prev); n.delete(stage.id); return n })
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && stage.localName.trim()) saveEdit(stage.id)
                          if (e.key === 'Escape') cancelEdit(stage.id)
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-20"
                        autoFocus
                      />
                      {fb?.type === 'error' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {fb.msg}
                        </span>
                      )}
                    </div>

                    {/* Save */}
                    <button
                      onClick={() => saveEdit(stage.id)}
                      disabled={isSaving || !stage.localName.trim()}
                      className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      {isSaving
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Check className="w-3 h-3" />
                      }
                      Save
                    </button>

                    {/* Cancel */}
                    <button
                      onClick={() => cancelEdit(stage.id)}
                      disabled={isSaving}
                      className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                ) : (
                  /* ── Display row ───────────────────────────────────── */
                  <div className="flex items-center gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-25"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === stages.length - 1}
                        className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-25"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>

                    {/* Color dot */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />

                    {/* Stage name */}
                    <span className="flex-1 font-medium text-slate-900 truncate">
                      {escapeHtml(stage.name)}
                    </span>

                    {/* Inline feedback */}
                    <AnimatePresence>
                      {fb && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className={`text-xs font-medium ${
                            fb.type === 'success' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {fb.msg}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Edit */}
                    <button
                      onClick={() => startEdit(stage.id)}
                      disabled={isSaving}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 disabled:opacity-40 transition-colors"
                      title="Edit stage"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteStage(stage.id)}
                      disabled={isSaving}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                      title="Delete stage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Add new stage form */}
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
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
              />

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setAddError('') }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim()) handleAdd()
                    if (e.key === 'Escape') handleCancelAdd()
                  }}
                  placeholder="Stage name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-20"
                  autoFocus
                />
                {addError && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {addError}
                  </span>
                )}
              </div>

              <button
                onClick={handleAdd}
                disabled={savingSet.has(-1) || !newName.trim()}
                className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
              >
                {savingSet.has(-1)
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Plus className="w-3 h-3" />
                }
                Add
              </button>

              <button
                onClick={handleCancelAdd}
                disabled={savingSet.has(-1)}
                className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {stages.length === 0 && !isAdding && (
        <div className="text-center py-12 text-slate-400">
          <p>No pipeline stages yet. Add your first stage above.</p>
        </div>
      )}
    </div>
  )
}
