import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, File, AlertCircle } from 'lucide-react';
import { gedService, type GedPasta, type GedCategoria, type GedDisciplina } from '../../../services/ged.service';

const DISCIPLINAS: { value: GedDisciplina; label: string }[] = [
  { value: 'ARQ', label: 'Arquitetura' },
  { value: 'EST', label: 'Estrutural' },
  { value: 'HID', label: 'Hidráulica' },
  { value: 'ELE', label: 'Elétrica' },
  { value: 'MEC', label: 'Mecânica' },
  { value: 'GEO', label: 'Geotecnia' },
];

const uploadSchema = z.object({
  titulo: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  pastaId: z.string().min(1, 'Selecione uma pasta'),
  categoriaId: z.string().min(1, 'Selecione uma categoria'),
  disciplina: z.string().optional(),
  numeroRevisao: z.string().default('0'),
  dataValidade: z.string().optional(),
  descricao: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface GedUploadModalProps {
  obraId: number;
  pastas: GedPasta[];
  categorias: GedCategoria[];
  onClose: () => void;
  onSuccess: () => void;
}

export function GedUploadModal({
  obraId,
  pastas,
  categorias,
  onClose,
  onSuccess,
}: GedUploadModalProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { numeroRevisao: '0' },
  });

  const handleFile = useCallback((f: File) => {
    setArquivo(f);
    setErroUpload(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const onSubmit = async (formData: UploadFormData) => {
    if (!arquivo) {
      setErroUpload('Selecione um arquivo para upload.');
      return;
    }

    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('titulo', formData.titulo);
    fd.append('pastaId', formData.pastaId);
    fd.append('categoriaId', formData.categoriaId);
    fd.append('numeroRevisao', formData.numeroRevisao);
    if (formData.disciplina) fd.append('disciplina', formData.disciplina);
    if (formData.dataValidade) fd.append('dataValidade', formData.dataValidade);
    if (formData.descricao) fd.append('descricao', formData.descricao);

    try {
      setUploading(true);
      setErroUpload(null);
      setProgresso(0);

      await gedService.upload(obraId, fd, (pct) => setProgresso(pct));

      onSuccess();
    } catch {
      setErroUpload('Erro ao fazer upload. Tente novamente.');
      setUploading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '9px 12px',
    color: 'var(--text-high)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-mid)',
    marginBottom: '5px',
    display: 'block',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--nc)',
    marginTop: '4px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Upload size={20} color="var(--accent)" />
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-high)' }}>
              Upload de Documento
            </h2>
          </div>
          {!uploading && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-mid)',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '24px' }}>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--accent)' : arquivo ? 'var(--ok)' : 'var(--border)'}`,
              borderRadius: '10px',
              padding: '28px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'var(--accent-dim)' : arquivo ? 'var(--ok-bg)' : 'var(--bg-base)',
              transition: 'all var(--transition-fast)',
              marginBottom: '20px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {arquivo ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <File size={20} color="var(--ok)" />
                <span style={{ fontSize: '14px', color: 'var(--ok)', fontWeight: 500 }}>
                  {arquivo.name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>
                  ({(arquivo.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <>
                <Upload size={32} color="var(--text-faint)" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-mid)', margin: 0 }}>
                  Arraste um arquivo ou{' '}
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>clique para selecionar</span>
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>
                  PDF, DWG, DOCX, XLSX, imagens...
                </p>
              </>
            )}
          </div>

          {/* Campos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Título */}
            <div>
              <label style={labelStyle}>Título *</label>
              <input {...register('titulo')} style={inputStyle} placeholder="Ex: Memorial Descritivo v1" />
              {errors.titulo && <p style={errorStyle}>{errors.titulo.message}</p>}
            </div>

            {/* Pasta + Categoria */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Pasta *</label>
                <select {...register('pastaId')} style={inputStyle}>
                  <option value="">Selecione...</option>
                  {pastas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                {errors.pastaId && <p style={errorStyle}>{errors.pastaId.message}</p>}
              </div>

              <div>
                <label style={labelStyle}>Categoria *</label>
                <select {...register('categoriaId')} style={inputStyle}>
                  <option value="">Selecione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {errors.categoriaId && <p style={errorStyle}>{errors.categoriaId.message}</p>}
              </div>
            </div>

            {/* Disciplina + Revisão */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Disciplina</label>
                <select {...register('disciplina')} style={inputStyle}>
                  <option value="">Nenhuma</option>
                  {DISCIPLINAS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Número de Revisão</label>
                <input
                  {...register('numeroRevisao')}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Data de Validade */}
            <div>
              <label style={labelStyle}>Data de Validade</label>
              <input type="date" {...register('dataValidade')} style={inputStyle} />
            </div>

            {/* Descrição */}
            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea
                {...register('descricao')}
                style={{ ...inputStyle, minHeight: '72px', resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Observações sobre este documento..."
              />
            </div>
          </div>

          {/* Erro */}
          {erroUpload && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'var(--nc-bg)',
                border: '1px solid var(--nc)',
                borderRadius: '8px',
                marginTop: '16px',
              }}
            >
              <AlertCircle size={16} color="var(--nc)" />
              <span style={{ fontSize: '13px', color: 'var(--nc)' }}>{erroUpload}</span>
            </div>
          )}

          {/* Progresso */}
          {uploading && (
            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: 'var(--text-mid)',
                  marginBottom: '6px',
                }}
              >
                <span>Enviando arquivo...</span>
                <span>{progresso}%</span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'var(--bg-raised)',
                  borderRadius: '99px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progresso}%`,
                    background: 'var(--accent)',
                    borderRadius: '99px',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          )}

          {/* Ações */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '24px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-mid)',
                borderRadius: '8px',
                padding: '9px 18px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: uploading ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading}
              style={{
                background: 'var(--accent)',
                border: 'none',
                color: '#000',
                borderRadius: '8px',
                padding: '9px 20px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                opacity: uploading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Upload size={15} />
              {uploading ? 'Enviando...' : 'Fazer Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
