/**
 * Lab page error boundary — never fail silently on Architecture / Materiality.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  pageLabel: string
  onLog?: (lines: string[]) => void
  children: ReactNode
}

type State = {
  error: Error | null
}

export class LabErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const reason = error.message || String(error)
    console.error(`[lab] ${this.props.pageLabel} failed to load:`, error, info.componentStack)
    this.props.onLog?.([
      `[lab] ${this.props.pageLabel} failed to load: ${reason}`,
    ])
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.pageLabel !== this.props.pageLabel && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      const reason = this.state.error.message || String(this.state.error)
      return (
        <div className="decay-lab-error" role="alert">
          <p>
            {this.props.pageLabel} failed to load: {reason}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
