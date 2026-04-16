// frontend-web/src/modules/fvs/inspecao/components/MarkupCanvas.tsx
// Editor de anotações sobre foto de evidência (seta, círculo, texto, retângulo)
// Uses HTML5 Canvas — sem dependências externas
import { useRef, useEffect, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../services/api'
import { ArrowRight, Circle, Type, Square, Trash2, Save, X } from 'lucide-react'

type TipoMarkup = 'seta' | 'circulo' | 'texto' | 'retangulo'

interface Anotacao {
  id?: number
  tipo: TipoMarkup
  dados_json: Record<string, unknown>
}

interface Point { x: number; y: number }

interface Props {
  evidenciaId: number
  imageUrl: string
  onClose: () => void
}

const CORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#ffffff']

export function MarkupCanvas({ evidenciaId, imageUrl, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const qc = useQueryClient()

  const [tipo, setTipo] = useState<TipoMarkup>('seta')
  const [cor, setCor] = useState('#ef4444')
  const [texto, setTexto] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState<Point | null>(null)
  const [currentPt, setCurrentPt] = useState<Point | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  // ── Buscar anotações existentes ───────────────────────────────────────────────
  const { data: anotacoes = [] } = useQuery<Anotacao[]>({
    queryKey: ['markup', evidenciaId],
    queryFn: () => api.get(`/fvs/evidencias/${evidenciaId}/markup`).then(r => r.data),
  })

  const salvar = useMutation({
    mutationFn: (a: Omit<Anotacao, 'id'>) =>
      api.post(`/fvs/evidencias/${evidenciaId}/markup`, a).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markup', evidenciaId] }),
  })

  const excluir = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/fvs/markup/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markup', evidenciaId] }),
  })

  // ── Desenhar tudo no canvas ───────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Anotações salvas
    for (const a of anotacoes) {
      drawShape(ctx, a.tipo, a.dados_json, canvas.width, canvas.height)
    }

    // Preview em desenho
    if (drawing && startPt && currentPt && tipo !== 'texto') {
      ctx.save()
      ctx.strokeStyle = cor
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.8
      const { x1, y1, x2, y2 } = pts2abs(startPt, currentPt, canvas.width, canvas.height)
      drawRaw(ctx, tipo, x1, y1, x2, y2)
      ctx.restore()
    }
  }, [anotacoes, drawing, startPt, currentPt, tipo, cor, imgLoaded])

  useEffect(() => { redraw() }, [redraw])

  // ── Carregar imagem ──────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
      }
      setImgLoaded(true)
    }
    img.src = imageUrl
  }, [imageUrl])

  // ── Eventos do mouse ─────────────────────────────────────────────────────────
  function getRelPt(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX / canvas.width,
      y: (e.clientY - rect.top) * scaleY / canvas.height,
    }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    setDrawing(true)
    setStartPt(getRelPt(e))
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return
    setCurrentPt(getRelPt(e))
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !startPt) return
    const end = getRelPt(e)
    setDrawing(false)

    if (tipo === 'texto') {
      if (!texto.trim()) return
      salvar.mutate({
        tipo,
        dados_json: { x: startPt.x, y: startPt.y, texto, cor },
      })
    } else {
      salvar.mutate({
        tipo,
        dados_json: { x1: startPt.x, y1: startPt.y, x2: end.x, y2: end.y, cor },
      })
    }
    setStartPt(null)
    setCurrentPt(null)
  }

  // ── Helpers de desenho ───────────────────────────────────────────────────────
  function pts2abs(p1: Point, p2: Point, w: number, h: number) {
    return { x1: p1.x * w, y1: p1.y * h, x2: p2.x * w, y2: p2.y * h }
  }

  function drawRaw(ctx: CanvasRenderingContext2D, t: TipoMarkup, x1: number, y1: number, x2: number, y2: number) {
    if (t === 'seta') {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      // Ponta da seta
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = 14
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4))
      ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fill()
    } else if (t === 'circulo') {
      const rx = Math.abs(x2 - x1) / 2
      const ry = Math.abs(y2 - y1) / 2
      ctx.beginPath()
      ctx.ellipse(x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2, rx, ry, 0, 0, 2 * Math.PI)
      ctx.stroke()
    } else if (t === 'retangulo') {
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    }
  }

  function drawShape(ctx: CanvasRenderingContext2D, t: TipoMarkup, dados: Record<string, unknown>, w: number, h: number) {
    const c = String(dados.cor ?? '#ef4444')
    ctx.save()
    ctx.strokeStyle = c
    ctx.fillStyle = c
    ctx.lineWidth = 3

    if (t === 'texto') {
      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = c
      ctx.fillText(String(dados.texto ?? ''), Number(dados.x) * w, Number(dados.y) * h)
    } else {
      const { x1, y1, x2, y2 } = pts2abs(
        { x: Number(dados.x1), y: Number(dados.y1) },
        { x: Number(dados.x2), y: Number(dados.y2) },
        w, h,
      )
      drawRaw(ctx, t, x1, y1, x2, y2)
    }
    ctx.restore()
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl bg-[var(--bg-base)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] flex-wrap">
          <span className="text-sm font-semibold text-[var(--text-high)] mr-2">Anotações</span>

          {/* Tipo */}
          {([
            { t: 'seta', icon: ArrowRight, label: 'Seta' },
            { t: 'circulo', icon: Circle, label: 'Círculo' },
            { t: 'retangulo', icon: Square, label: 'Retângulo' },
            { t: 'texto', icon: Type, label: 'Texto' },
          ] as const).map(({ t, icon: Icon, label }) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              title={label}
              className={`p-1.5 rounded-md transition-colors ${tipo === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-low)] hover:bg-[var(--off-bg)]'}`}
            >
              <Icon size={16} />
            </button>
          ))}

          <div className="w-px h-5 bg-[var(--border)]" />

          {/* Cores */}
          {CORES.map(c => (
            <button
              key={c}
              onClick={() => setCor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${cor === c ? 'scale-125 border-[var(--text-high)]' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}

          {tipo === 'texto' && (
            <input
              type="text"
              placeholder="Texto…"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              className="ml-2 px-2 py-1 text-sm rounded-md border border-[var(--border)] bg-[var(--off-bg)] text-[var(--text-high)] w-32"
            />
          )}

          <div className="ml-auto flex items-center gap-2">
            {anotacoes.length > 0 && (
              <span className="text-xs text-[var(--text-low)]">{anotacoes.length} anotações</span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-low)] hover:text-[var(--text-high)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/30">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full cursor-crosshair rounded-lg"
            style={{ imageRendering: 'pixelated' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { setDrawing(false); setStartPt(null); setCurrentPt(null) }}
          />
        </div>

        {/* Lista de anotações */}
        {anotacoes.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {anotacoes.map(a => (
                <div
                  key={a.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--off-bg)] text-xs text-[var(--text-low)]"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: String(a.dados_json.cor ?? '#ef4444') }} />
                  <span className="capitalize">{a.tipo}{a.tipo === 'texto' ? `: ${String(a.dados_json.texto ?? '').slice(0, 20)}` : ''}</span>
                  <button
                    onClick={() => a.id && excluir.mutate(a.id)}
                    className="hover:text-[var(--nc)] ml-0.5"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {salvar.isPending && (
          <div className="absolute bottom-4 right-4 text-xs text-[var(--text-low)] bg-[var(--bg-card)] px-2 py-1 rounded-md border border-[var(--border)]">
            <Save size={10} className="inline mr-1" />Salvando…
          </div>
        )}
      </div>
    </div>
  )
}
