// frontend-web/src/modules/almoxarifado/estoque/components/ImportarPlanilhaModal.tsx
import { useState, useRef } from 'react'
import { Download, Upload, X, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui'
import { useLocaisEstoque } from '../hooks/useEstoque'
import { almoxarifadoService, type ImportacaoResultado } from '../../_service/almoxarifado.service'

interface ImportarPlanilhaModalProps {
  onClose: () => void
  onSuccess: () => void
}

type Etapa = 'configurar' | 'upload' | 'resultado'

export function ImportarPlanilhaModal({ onClose, onSuccess }: ImportarPlanilhaModalProps) {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: locais = [] } = useLocaisEstoque()

  const [etapa, setEtapa]           = useState<Etapa>('configurar')
  const [localId, setLocalId]       = useState<number | ''>('')
  const [arquivo, setArquivo]       = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado]   = useState<ImportacaoResultado | null>(null)
  const [baixando, setBaixando]     = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  async function handleBaixarTemplate() {
    setBaixando(true)
    try {
      await almoxarifadoService.downloadTemplateEstoque()
    } catch {
      toast.error('Erro ao baixar modelo')
    } finally {
      setBaixando(false)
    }
  }

  function handleArquivo(file: File | null) {
    if (!file) return
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Apenas arquivos .xlsx são aceitos')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 5 MB)')
      return
    }
    setArquivo(file)
    setEtapa('upload')
  }

  async function handleImportar() {
    if (!localId || !arquivo) return
    setImportando(true)
    try {
      const res = await almoxarifadoService.importarEstoque(Number(localId), arquivo)
      setResultado(res)
      setEtapa('resultado')
      qc.invalidateQueries({ queryKey: ['alm-estoque'] })
      if (res.processadas > 0) onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao importar planilha')
    } finally {
      setImportando(false)
    }
  }

  const canImportar = !!localId && !!arquivo && !importando

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-dim)]">
          <h2 className="text-[14px] font-semibold text-[var(--text-high)]">
            Importar Estoque via Planilha
          </h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">

          {/* Etapa 1+2 — Configurar + Upload */}
          {(etapa === 'configurar' || etapa === 'upload') && (
            <div className="space-y-4">
              {/* Local */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1.5">
                  Local de destino <span className="text-[var(--nc)]">*</span>
                </label>
                <select
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Selecione o local...</option>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome}</option>
                  ))}
                </select>
              </div>

              {/* Baixar modelo */}
              <div className="flex items-center justify-between p-3 bg-[var(--bg-raised)] rounded-sm border border-[var(--border-dim)]">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-high)]">Modelo de importação</p>
                  <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Baixe, preencha e faça o upload</p>
                </div>
                <button
                  onClick={handleBaixarTemplate}
                  disabled={baixando}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-sm',
                    'border border-[var(--border)] text-[var(--accent)]',
                    'hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-50',
                  )}
                >
                  <Download size={13} />
                  {baixando ? 'Baixando...' : 'Baixar modelo'}
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleArquivo(e.dataTransfer.files[0] ?? null) }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors',
                  arquivo
                    ? 'border-[var(--ok)] bg-[var(--ok-bg)]'
                    : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]',
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleArquivo(e.target.files?.[0] ?? null)}
                />
                <Upload size={20} className={cn('mx-auto mb-2', arquivo ? 'text-[var(--ok)]' : 'text-[var(--text-faint)]')} />
                {arquivo ? (
                  <>
                    <p className="text-[13px] font-medium text-[var(--ok)]">{arquivo.name}</p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
                      {(arquivo.size / 1024).toFixed(0)} KB · clique para trocar
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-[var(--text-low)]">Arraste o arquivo ou clique para selecionar</p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Apenas .xlsx · máximo 5 MB</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Etapa 3 — Resultado */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="flex gap-3">
                <div className="flex-1 text-center p-3 bg-[var(--ok-bg)] rounded-sm border border-[var(--ok)]/30">
                  <p className="text-[22px] font-bold text-[var(--ok)]">{resultado.processadas}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">processados</p>
                </div>
                <div className="flex-1 text-center p-3 bg-[var(--nc-bg)] rounded-sm border border-[var(--nc)]/30">
                  <p className="text-[22px] font-bold text-[var(--nc)]">{resultado.erros.length}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">erros</p>
                </div>
                <div className="flex-1 text-center p-3 bg-[var(--warn-bg)] rounded-sm border border-[var(--warn)]/30">
                  <p className="text-[22px] font-bold text-[var(--warn)]">{resultado.avisos.length}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">avisos</p>
                </div>
              </div>

              {/* Erros */}
              {resultado.erros.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-[12px] font-semibold text-[var(--nc)] flex items-center gap-1">
                    <AlertOctagon size={12} /> Erros
                  </p>
                  {resultado.erros.map((e, idx) => (
                    <div key={idx} className="text-[12px] text-[var(--text-low)] px-2 py-1 bg-[var(--nc-bg)] rounded-sm">
                      <span className="font-mono text-[var(--nc)]">Linha {e.linha}</span> · {e.motivo}
                    </div>
                  ))}
                </div>
              )}

              {/* Avisos */}
              {resultado.avisos.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <p className="text-[12px] font-semibold text-[var(--warn)] flex items-center gap-1">
                    <AlertTriangle size={12} /> Avisos
                  </p>
                  {resultado.avisos.map((a, idx) => (
                    <div key={idx} className="text-[12px] text-[var(--text-low)] px-2 py-1 bg-[var(--warn-bg)] rounded-sm">
                      <span className="font-mono text-[var(--warn)]">Linha {a.linha}</span> · {a.motivo}
                    </div>
                  ))}
                </div>
              )}

              {resultado.erros.length === 0 && resultado.avisos.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-[var(--ok-bg)] rounded-sm border border-[var(--ok)]/30">
                  <CheckCircle size={16} className="text-[var(--ok)]" />
                  <p className="text-[13px] text-[var(--ok)]">Importação concluída sem erros</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)]">
          {etapa !== 'resultado' ? (
            <>
              <button
                onClick={onClose}
                disabled={importando}
                className="px-4 py-2 text-[13px] border border-[var(--border)] rounded-sm text-[var(--text-high)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportar}
                disabled={!canImportar}
                className={cn(
                  'flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold rounded-sm',
                  'bg-[var(--accent)] text-white hover:opacity-90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {importando ? 'Importando...' : (<><Upload size={13} /> Importar</>)}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 text-[13px] font-semibold bg-[var(--accent)] text-white rounded-sm hover:opacity-90"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
