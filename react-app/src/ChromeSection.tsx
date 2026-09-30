import { useState, type ReactNode } from 'react'

type ChromeSectionProps = {
  title: string
  children: ReactNode
  /** When true, the section starts expanded. */
  defaultOpen?: boolean
}

/** Collapsible panel box — visual only; children keep the same controls. */
export function ChromeSection({ title, children, defaultOpen = false }: ChromeSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className={open ? 'chrome-group is-open' : 'chrome-group'}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="chrome-group-summary">
        <span className="chrome-group-title">{title}</span>
        <span className="chrome-group-chevron" aria-hidden="true" />
      </summary>
      <div className="chrome-group-body">{children}</div>
    </details>
  )
}
