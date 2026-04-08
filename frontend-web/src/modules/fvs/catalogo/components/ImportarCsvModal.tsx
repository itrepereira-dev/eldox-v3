import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { fvsService, type ImportResult } from '@/services/fvs.service'
import { X, Upload, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const CSV_TEMPLATE = `categoria,codigo,nome,norma,item_descricao,criticidade,foto_modo
Alvenaria,PO 10.01,EXECUÇÃO DE ALVENARIA DE VEDAÇÃO,NBR 8545,BLOCOS ALINHADOS (DESVIO MÁX. 3MM/M)?,maior,opcional
Alvenaria,PO 10.01,EXECUÇÃO DE ALVENARIA DE VEDAÇÃO,NBR 8545,JUNTAS COM ESPESSURA UNIFORME (10±3MM)?,menor,opcional`

interface Props { open: boolean; onSuccess: () => void; onClose: () => void }

export function ImportarCsvModal({ open, onSuccess, onClose }: Props) {
  const [file, setFile]             = useState<File | null>(null)
  const [preview, setPreview]       = useState<ImportResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setFile(null); setPreview(null); setLoading(false); setConfirming(false) }
  }, [open])

  if (!open) return null

  const handleFile = async (f: File) => {
    setFile(f)
    setLoading(true)
    try {
      const result = await fvsService.importarCsv(f, true)
      setPreview(result)
    } catch {
      setPreview({ preview: [], errors: ['Erro ao ler o arquivo. Verifique o formato CSV.'], total: 0 })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!file) return
    setConfirming(true)
    try {
      await fvsService.importarCsv(file, false)
      onSuccess()
      onClose()
    } finally {
      setConfirming(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template-servicos-fvs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const hasErrors = (preview?.errors?.length ?? 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-lg',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)]',
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-high)]">Importar Serviços via CSV</h3>
          <button onClick={onClose} aria-label="Fechar modal" className="text-[var(--text-faint)] hover:text-[var(--text-high)]"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-[var(--bg-raised)] rounded border border-[var(--border-dim)]">
            <div>
              <p className="text-[12px] font-medium text-[var(--text-high)]">Template CSV</p>
              <p className="text-[11px] text-[var(--text-faint)]">Colunas: categoria, codigo, nome, norma, item_descricao, criticidade, foto_modo</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 h-8 rounded-sm text-[12px] border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Download size={12} /> Baixar
            </button>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center p-6 rounded border-2 border-dashed cursor-pointer transition-colors',
              file ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] hover:border-[var(--accent)]',
            )}
          >
            <Upload size={20} className={cn('mb-2', file ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]')} />
            <p className="text-[13px] text-[var(--text-mid)]">
              {file ? file.name : 'Clique para selecionar arquivo .csv ou .xlsx'}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-[var(--text-faint)] text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Analisando arquivo...
            </div>
          )}

          {preview && !loading && (
            <div className="space-y-2">
              {hasErrors ? (
                <div className="flex items-start gap-2 p-3 bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded">
                  <AlertCircle size={14} className="text-[var(--nc)] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-[var(--nc-text)]">Erros encontrados</p>
                    {preview.errors.map((e, i) => <p key={i} className="text-[11px] text-[var(--nc-text)]">{e}</p>)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-[var(--ok-bg)] border border-[var(--ok-border)] rounded">
                  <CheckCircle size={14} className="text-[var(--ok)]" />
                  <p className="text-[12px] text-[var(--ok-text)]">{preview.total} registro{preview.total !== 1 ? 's' : ''} prontos para importar</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button onClick={onClose} className="px-4 h-9 rounded-sm text-[13px] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview || hasErrors || confirming}
            className="px-4 h-9 rounded-sm text-[13px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            {confirming ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Importação'}
          </button>
        </div>
      </div>
    </div>
  )
}
