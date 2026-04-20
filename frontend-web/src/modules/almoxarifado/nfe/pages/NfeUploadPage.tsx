// frontend-web/src/modules/almoxarifado/nfe/pages/NfeUploadPage.tsx
import React, { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Upload, FileText, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUploadNfeXml } from '../hooks/useNfe'

export function NfeUploadPage() {
  const navigate = useNavigate()
  const upload = useUploadNfeXml()

  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<null | {
    status: 'aceito' | 'duplicado'
    chave_nfe: string
    nfeId?: number
  }>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File) {
    setErro(null)
    setResultado(null)
    setFileName(file.name)
    try {
      const r = await upload.mutateAsync(file)
      setResultado(r)
      if (r.nfeId) {
        // Se duplicado, redireciona para NF já existente após 1.2s
        setTimeout(() => navigate(`/almoxarifado/nfes/${r.nfeId}`), 1200)
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErro(msg ?? 'Erro ao processar XML. Verifique se o arquivo é uma NF-e 4.0 válida.')
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErro('Arquivo precisa ter extensão .xml')
      return
    }
    handleFile(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handleFile(file)
    // reset input pra poder re-enviar mesmo arquivo
    e.target.value = ''
  }

  return (
    <div className="p-6 max-w-[720px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-5 text-[12px]">
        <Link to="/almoxarifado/nfes" className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
          Notas Fiscais
        </Link>
        <ChevronRight size={11} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-high)] font-medium">Upload XML</span>
      </div>

      <h1 className="text-[18px] font-bold text-[var(--text-high)] mb-1">Importar NF-e via XML</h1>
      <p className="text-[13px] text-[var(--text-low)] mb-6">
        Arraste o arquivo <span className="font-mono">.xml</span> da NF-e 4.0 aqui. A NF será criada com status{' '}
        <strong>pendente de match</strong> e entra no fluxo normal de revisão.
      </p>

      {/* Dropzone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'rounded-md border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
          dragActive
            ? 'border-[var(--accent)] bg-[var(--accent-bg,rgba(88,166,255,0.06))]'
            : 'border-[var(--border-dim)] hover:border-[var(--border)] bg-[var(--bg-surface)]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,application/xml,text/xml"
          onChange={onInputChange}
          className="hidden"
        />
        <Upload size={32} className={cn('mx-auto mb-3', dragActive ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]')} />
        <p className="text-[13px] font-medium text-[var(--text-high)]">
          {dragActive ? 'Solte o arquivo aqui' : 'Arraste e solte o XML ou clique para selecionar'}
        </p>
        <p className="text-[11px] text-[var(--text-faint)] mt-1">Tamanho máximo: 2 MB · apenas NF-e modelo 55</p>
      </div>

      {/* Estado: processando */}
      {fileName && upload.isPending && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-[var(--text-low)]">
          <FileText size={14} />
          <span>Processando <span className="font-mono">{fileName}</span>…</span>
        </div>
      )}

      {/* Estado: erro */}
      {erro && (
        <div className="mt-4 p-3 rounded-md border border-[var(--nc)] bg-[var(--nc-bg)] flex items-start gap-2">
          <AlertCircle size={14} className="text-[var(--nc)] mt-0.5 flex-shrink-0" />
          <div className="text-[12px] text-[var(--nc)]">{erro}</div>
        </div>
      )}

      {/* Estado: sucesso */}
      {resultado && !erro && (
        <div className="mt-4 p-3 rounded-md border border-[var(--ok)] bg-[var(--ok-bg)] flex items-start gap-2">
          <CheckCircle size={14} className="text-[var(--ok)] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[var(--ok)]">
              {resultado.status === 'aceito'
                ? 'NF-e importada com sucesso.'
                : 'Esta NF-e já havia sido importada.'}
            </p>
            <p className="text-[11px] text-[var(--text-low)] mt-0.5 font-mono">
              Chave: {resultado.chave_nfe}
            </p>
            {resultado.status === 'aceito' && (
              <p className="text-[12px] text-[var(--text-low)] mt-1">
                O sistema está processando os itens e fazendo o match com o catálogo. Em alguns segundos ela aparecerá na{' '}
                <Link to="/almoxarifado/nfes" className="text-[var(--accent)] hover:underline">lista de NFs</Link>.
              </p>
            )}
            {resultado.nfeId && (
              <p className="text-[12px] text-[var(--text-low)] mt-1">Redirecionando para o detalhe…</p>
            )}
          </div>
        </div>
      )}

      {/* Instruções pós-upload */}
      <div className="mt-8 pt-6 border-t border-[var(--border-dim)]">
        <h3 className="text-[13px] font-semibold text-[var(--text-high)] mb-2">O que acontece em seguida?</h3>
        <ul className="text-[12px] text-[var(--text-low)] space-y-1.5 list-disc pl-5">
          <li>A NF-e entra na fila de processamento e ganha status <strong>pendente de match</strong></li>
          <li>A IA tenta vincular cada item ao seu catálogo de materiais automaticamente</li>
          <li>Na tela de detalhe da NF, itens pendentes mostram sugestões — confirme as que estiverem corretas</li>
          <li>Ao aceitar a NF, veja o <strong>preview de conversão de unidades</strong> por item antes de confirmar</li>
          <li>Itens com UM diferente do catálogo são convertidos automaticamente no aceite</li>
        </ul>
      </div>
    </div>
  )
}
