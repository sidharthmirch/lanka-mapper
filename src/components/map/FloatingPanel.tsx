'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode, type PointerEvent } from 'react'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

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
  const panelRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ px: number; py: number; bx: number; by: number } | null>(null)

  const clampOffset = (next: { x: number; y: number }, current = offset) => {
    const panel = panelRef.current
    const container = panel?.parentElement
    if (!panel || !container) return next

    const panelRect = panel.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    return {
      x: Math.min(
        Math.max(next.x, current.x + containerRect.left - panelRect.left),
        current.x + containerRect.right - panelRect.right,
      ),
      y: Math.min(
        Math.max(next.y, current.y + containerRect.top - panelRect.top),
        current.y + containerRect.bottom - panelRect.bottom,
      ),
    }
  }

  const moveBy = (x: number, y: number) => {
    setOffset((current) => clampOffset({ x: current.x + x, y: current.y + y }, current))
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    drag.current = { px: e.clientX, py: e.clientY, bx: offset.x, by: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    setOffset(clampOffset({ x: d.bx + (e.clientX - d.px), y: d.by + (e.clientY - d.py) }))
  }
  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }
  }
  const onDragKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 48 : 16
    const delta = e.key === 'ArrowLeft'
      ? [-step, 0]
      : e.key === 'ArrowRight'
        ? [step, 0]
        : e.key === 'ArrowUp'
          ? [0, -step]
          : e.key === 'ArrowDown'
            ? [0, step]
            : null
    if (!delta) return
    e.preventDefault()
    moveBy(delta[0], delta[1])
  }

  return (
    <div
      ref={panelRef}
      className={className}
      style={offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={`Drag ${label}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onDragKeyDown}
          title="Drag to move. Arrow keys move; Shift + arrow moves farther."
          className="flex h-7 cursor-grab touch-none items-center rounded-md px-1 text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)] active:cursor-grabbing"
        >
          <DragIndicatorIcon sx={{ fontSize: 16 }} />
        </button>
        <button
          type="button"
          aria-label={`Reset ${label} position`}
          onClick={() => setOffset({ x: 0, y: 0 })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          <RestartAltIcon sx={{ fontSize: 15 }} />
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
