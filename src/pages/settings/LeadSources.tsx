import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export function LeadSources() {
  const [sources, setSources] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newSource, setNewSource] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchSources = async () => {
    try {
      const data = await api.get('/settings/sources')
      setSources(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSources()
  }, [])

  const handleSave = async (source: { id: number; name: string }) => {
    setSaving(true)
    try {
      await api.put('/settings/sources', sources.map((s) => 
        s.id === source.id ? source : s
      ))
      setSources((prev) => prev.map((s) => s.id === source.id ? source : s))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this source?')) return
    try {
      await api.put('/settings/sources', sources.filter((s) => s.id !== id))
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleAdd = async () => {
    if (!newSource.trim()) return
    setSaving(true)
    try {
      const maxId = Math.max(...sources.map((s) => s.id), 0)
      const created = { id: maxId + 1, name: newSource.trim() }
      await api.post('/settings/sources', [...sources, created])
      setSources([...sources, created])
      setNewSource('')
      setAddingNew(false)
    } catch (err) {
      console.error('Failed to add:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lead Sources</h2>
          <p className="text-sm text-slate-500">Manage where your leads come from</p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Source
        </button>
      </div>

      <div className="space-y-2">
        {sources.map((source) => (
          <motion.div
            key={source.id}
            layout
            className="card p-4"
          >
            {editingId === source.id ? (
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl"
                  autoFocus
                />
                <button onClick={() => handleSave({ id: source.id, name: editingName })} disabled={saving} className="btn-primary text-sm">
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex-1 font-medium text-slate-900">{source.name}</span>
                <button
                  onClick={() => { setEditingId(source.id); setEditingName(source.name) }}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(source.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {addingNew && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4"
        >
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="Source name"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl"
              autoFocus
            />
            <button onClick={handleAdd} disabled={saving || !newSource.trim()} className="btn-primary text-sm">
              {saving ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => { setAddingNew(false); setNewSource('') }} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
