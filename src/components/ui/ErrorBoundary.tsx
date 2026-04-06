import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, message: undefined })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-center">
          <div className="max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-2">앗, 홀시가 잠깐 멈췄어요</h2>
            <p className="text-sm text-zinc-400 font-medium mb-5 leading-relaxed break-keep">
              예상치 못한 오류가 발생했어요.
              <br />새로고침하면 다시 동작할 거예요.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full bg-[var(--color-primary)] hover:bg-pink-600 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(255,42,122,0.4)]"
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
