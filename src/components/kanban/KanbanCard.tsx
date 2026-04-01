import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, getInitials, formatDate } from '@/lib/utils'
import type { Casting } from '@/types'

interface SortableCardProps {
  casting: Casting
  onClick: () => void
}

export function SortableCard({ casting, onClick }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(casting.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'card p-3 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-amber-400'
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
          {getInitials(casting.client_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">
            {casting.project_name || 'Untitled'}
          </p>
          <p className="text-xs text-slate-500 truncate">{casting.client_name}</p>
        </div>
      </div>
      {casting.shoot_date_start && (
        <p className="text-xs text-slate-400">{formatDate(casting.shoot_date_start)}</p>
      )}
    </div>
  )
}

interface DragOverlayCardProps {
  casting: Casting
}

export function DragOverlayCard({ casting }: DragOverlayCardProps) {
  return (
    <div className="card p-3 shadow-xl opacity-90 bg-white/90 backdrop-blur">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
          {getInitials(casting.client_name)}
        </div>
        <div>
          <p className="font-medium text-slate-900 text-sm">
            {casting.project_name || 'Untitled'}
          </p>
          <p className="text-xs text-slate-500">{casting.client_name}</p>
        </div>
      </div>
    </div>
  )
}
