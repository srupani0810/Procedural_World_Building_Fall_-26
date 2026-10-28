/** Append-only log so generation and vacating stay readable as events. */

export type ProcessKind = 'claim' | 'stack' | 'rule' | 'stage' | 'note'

export type ProcessEvent = {
  id: number
  at: number
  kind: ProcessKind
  cell: string
  detail: string
}

let nextId = 1

export function makeEvent(
  kind: ProcessKind,
  cell: string,
  detail: string,
  at = performance.now() / 1000,
): ProcessEvent {
  return { id: nextId++, at, kind, cell, detail }
}

export function formatEvent(event: ProcessEvent) {
  const t = event.at.toFixed(1)
  return `${t}s  [${event.kind}]  ${event.cell}  ${event.detail}`
}
