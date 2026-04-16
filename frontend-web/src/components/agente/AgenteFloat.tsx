// frontend-web/src/components/agente/AgenteFloat.tsx
// Agente master flutuante — copilot de navegação do Eldox
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bot, X, Send, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { api } from '@/services/api'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
  acao?: { tipo: string; rota: string; label: string }
  sugestoes?: string[]
}

interface ChatResponse {
  resposta: string
  acao?: { tipo: string; rota: string; label: string }
  sugestoes?: string[]
}

// ── Quick actions iniciais ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  'Nova inspeção FVS',
  'Ver não conformidades',
  'Criar RDO',
  'Abrir obras',
  'Ver almoxarifado',
  'Aprovações pendentes',
]

// ── Componente principal ───────────────────────────────────────────────────────

export function AgenteFloat() {
  const [aberto, setAberto]       = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput]         = useState('')
  const [carregando, setCarregando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const navigate  = useNavigate()
  const location  = useLocation()

  // Scroll automático para última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Foca input ao abrir
  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 150)
  }, [aberto])

  // Fecha com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function enviar(texto: string) {
    if (!texto.trim() || carregando) return

    const novaMensagem: Mensagem = { role: 'user', content: texto }
    const historico = mensagens.map(m => ({ role: m.role, content: m.content }))

    setMensagens(prev => [...prev, novaMensagem])
    setInput('')
    setCarregando(true)

    try {
      const { data } = await api.post<ChatResponse>('/ia/chat', {
        message: texto,
        historico,
        rota_atual: location.pathname,
      })

      setMensagens(prev => [...prev, {
        role: 'assistant',
        content: data.resposta,
        acao: data.acao,
        sugestoes: data.sugestoes,
      }])
    } catch {
      setMensagens(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, não consegui processar sua solicitação. Tente novamente.',
        sugestoes: ['Ver Dashboard', 'Abrir Obras'],
      }])
    } finally {
      setCarregando(false)
    }
  }

  function handleNavegar(rota: string) {
    navigate(rota)
    setAberto(false)
  }

  return (
    <>
      {/* ── Painel de chat ── */}
      {aberto && (
        <div
          className={cn(
            'fixed bottom-20 right-6 z-[99]',
            'w-[360px] max-h-[520px] flex flex-col',
            'rounded-2xl border border-[var(--border)]',
            'bg-[var(--bg-card)] shadow-2xl',
            'animate-in slide-in-from-bottom-4 fade-in duration-200',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center flex-shrink-0">
              <Sparkles size={13} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[var(--text-high)]">Eldo</p>
              <p className="text-[10px] text-[var(--text-faint)]">Assistente Eldox</p>
            </div>
            <button
              onClick={() => setAberto(false)}
              className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

            {/* Boas-vindas */}
            {mensagens.length === 0 && (
              <div className="space-y-3">
                <div className="bg-[var(--bg-raised)] rounded-xl rounded-tl-sm px-3 py-2.5 max-w-[90%]">
                  <p className="text-[13px] text-[var(--text-high)]">
                    Olá! Sou o <strong>Eldo</strong>, seu assistente. Posso te levar a qualquer módulo ou iniciar qualquer processo do sistema.
                  </p>
                </div>
                {/* Quick actions */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map(acao => (
                    <button
                      key={acao}
                      onClick={() => enviar(acao)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-medium',
                        'border border-[var(--border)] text-[var(--text-low)]',
                        'hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)]',
                        'transition-all duration-150',
                      )}
                    >
                      {acao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de mensagens */}
            {mensagens.map((msg, i) => (
              <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'max-w-[85%] px-3 py-2 rounded-xl text-[13px]',
                    msg.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-tr-sm'
                      : 'bg-[var(--bg-raised)] text-[var(--text-high)] rounded-tl-sm',
                  )}
                >
                  {msg.content}
                </div>

                {/* Card de navegação */}
                {msg.acao?.tipo === 'navegar' && (
                  <button
                    onClick={() => handleNavegar(msg.acao!.rota)}
                    className={cn(
                      'mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl',
                      'border border-[var(--accent)] text-[var(--accent)]',
                      'hover:bg-[var(--accent)] hover:text-white',
                      'text-[12px] font-medium transition-all duration-150',
                      'max-w-[85%]',
                    )}
                  >
                    <ArrowRight size={13} />
                    {msg.acao.label}
                  </button>
                )}

                {/* Sugestões de próxima ação */}
                {msg.role === 'assistant' && msg.sugestoes && msg.sugestoes.length > 0 && i === mensagens.length - 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.sugestoes.map(s => (
                      <button
                        key={s}
                        onClick={() => enviar(s)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-medium',
                          'border border-[var(--border)] text-[var(--text-faint)]',
                          'hover:border-[var(--accent)] hover:text-[var(--accent)]',
                          'transition-all duration-150',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {carregando && (
              <div className="flex items-start">
                <div className="bg-[var(--bg-raised)] rounded-xl rounded-tl-sm px-3 py-2.5">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)] animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)] animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)] animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-[var(--border)] flex-shrink-0">
            <form
              onSubmit={e => { e.preventDefault(); enviar(input) }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] focus-within:border-[var(--accent)] transition-colors"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Como posso ajudar?"
                disabled={carregando}
                className="flex-1 text-[13px] bg-transparent outline-none text-[var(--text-high)] placeholder:text-[var(--text-faint)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || carregando}
                className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--accent)] text-white disabled:opacity-30 transition-opacity hover:opacity-90"
              >
                <Send size={11} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Botão flutuante ── */}
      <button
        onClick={() => setAberto(v => !v)}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente Eldo'}
        className={cn(
          'fixed bottom-6 right-6 z-[100]',
          'w-13 h-13 rounded-full shadow-2xl',
          'flex items-center justify-center',
          'transition-all duration-200',
          aberto
            ? 'bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-high)] rotate-0'
            : 'bg-gradient-to-br from-[var(--accent)] to-purple-600 text-white hover:scale-110 active:scale-95',
        )}
        style={{ width: 52, height: 52 }}
      >
        {aberto
          ? <X size={20} />
          : <Bot size={22} />
        }
        {/* Pulse quando fechado */}
        {!aberto && (
          <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-20 pointer-events-none" />
        )}
      </button>
    </>
  )
}
