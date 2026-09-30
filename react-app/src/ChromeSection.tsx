import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ChromeSectionProps = {
  title: string
  /** Short description shown when hovering the expand/collapse arrow. */
  tip: string
  children: ReactNode
  /** When true, the section starts expanded. */
  defaultOpen?: boolean
}

/** Collapsible panel box — visual only; children keep the same controls. */
export function ChromeSection({ title, tip, children, defaultOpen = false }: ChromeSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null)
  const tipId = useId()

  const showTip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const tipWidth = 200
    const margin = 10
    // Prefer right of the arrow; flip left if it would leave the viewport
    let left = rect.right + margin
    if (left + tipWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - tipWidth - margin)
    }
    const top = Math.min(window.innerHeight - 8, Math.max(8, rect.top + rect.height / 2))
    setTipPos({ top, left })
  }

  return (
    <details
      className={open ? 'chrome-group is-open' : 'chrome-group'}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="chrome-group-summary">
        <span className="chrome-group-title">{title}</span>
        <span
          className="chrome-group-chevron-wrap"
          aria-label={tip}
          aria-describedby={tipPos ? tipId : undefined}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setOpen((value) => !value)
          }}
          onMouseEnter={(event) => showTip(event.currentTarget)}
          onMouseLeave={() => setTipPos(null)}
          onFocus={(event) => showTip(event.currentTarget)}
          onBlur={() => setTipPos(null)}
        >
          <span className="chrome-group-chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="chrome-group-body">{children}</div>
      {tipPos
        ? createPortal(
            <span
              id={tipId}
              className="chrome-group-tooltip is-visible"
              role="tooltip"
              style={{ top: tipPos.top, left: tipPos.left }}
            >
              {tip}
            </span>,
            document.body,
          )
        : null}
    </details>
  )
}
