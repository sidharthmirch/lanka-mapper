'use client'

import { useRef, useState, type ReactNode, type PointerEvent } from 'react'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'

interface FloatingPanelProps {
  /** Outer positioning classes (absolute placement on the map). */
  className?: string
  /** Hide the panel; when omitted the close affordance is not shown. */
  onClose?: () => void
  /** Accessible name for the panel (drag/close button labels). */
  label: string
  children: ReactNode
}

/**
 * Wraps a map overlay card so it can be dragged to reposition and closed.
 * Drag is driven by a grip handle (pointer-captured, so it never fights the
 * Leaflet pan beneath); position is a transform offset kept in component state
 * for the session. A small control strip (grip + ✕) sits above the card.
 */
export default function FloatingPanel({ className, onClose, label, children }: FloatingPanelProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ px: number; py: number; bx: number; by: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    drag.current = { px: e.clientX, py: e.clientY, bx: offset.x, by: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    setOffset({ x: d.bx + (e.clientX - d.px), y: d.by + (e.clientY - d.py) })
  }
  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }
  }

  return (
    <div
      className={className}
      style={offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
    >
      <div className="map-overlay-handle mb-0.5 flex items-center justify-between gap-1 rounded-t-md bg-[var(--surface)]/88 px-0.5 backdrop-blur-sm">
        <button
          type="button"
          aria-label={`Drag ${label}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => setOffset({ x: 0, y: 0 })}
          title="Drag to move · double-click to reset"
          className="flex h-7 cursor-grab touch-none items-center rounded-md px-1 text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)] active:cursor-grabbing"
        >
          <DragIndicatorIcon sx={{ fontSize: 16 }} />
        </button>
        {onClose && (
          <button
            type="button"
            aria-label={`Close ${label}`}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
