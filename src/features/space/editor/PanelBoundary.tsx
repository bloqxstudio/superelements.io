import React, { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  /** Nome do que quebrou, para o aviso ("as camadas", "as propriedades"). */
  what: string
  children: ReactNode
  /** Mudar a chave (outra camada, outra página) tenta de novo sozinho. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * Um painel que quebra com um dado inesperado (JSON importado de um site) fica
 * só com um aviso; o canvas e o resto do Space continuam funcionando.
 */
export class PanelBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Space] falhou ao mostrar ${this.props.what}:`, error, info.componentStack)
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <AlertTriangle className="h-5 w-5 text-amber-500" strokeWidth={1.75} />
        <p className="text-xs font-medium text-gray-700">Não deu para mostrar {this.props.what}.</p>
        <p className="text-[11px] leading-relaxed text-gray-400">O canvas continua funcionando. Tente de novo ou escolha outra camada.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-1 rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-transform active:scale-[0.96]"
        >
          Tentar de novo
        </button>
      </div>
    )
  }
}
