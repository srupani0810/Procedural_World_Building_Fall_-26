/**
 * Jump In error boundary — never leave a black canvas.
 * On any render/lifecycle failure: log, exit to orbit, surface a short reason.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  enabled: boolean
  onFail: (reason: string) => void
  children: ReactNode
}

type State = { failed: boolean }

export class JumpInErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const reason = error?.message ? String(error.message) : 'unknown error'
    console.error('[jump] Jump In failed:', error, info.componentStack)
    this.props.onFail(reason)
  }

  componentDidUpdate(prev: Props) {
    // Reset so a later Jump In attempt can remount children.
    if (prev.enabled && !this.props.enabled && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    // On failure, drop the FP subtree so the Canvas stays in orbit (parent clears jumpIn).
    if (this.state.failed) return null
    return this.props.children
  }
}
