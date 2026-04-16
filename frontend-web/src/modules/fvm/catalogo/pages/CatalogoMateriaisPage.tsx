// frontend-web/src/modules/fvm/catalogo/pages/CatalogoMateriaisPage.tsx
// Catálogo de materiais e itens de verificação — equivalente ao CatalogoPage do FVS
// Layout: painel esquerdo (categorias) + painel direito (materiais da categoria)

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Plus, ChevronRight } from 'lucide-react';
import { useCategoriasMateriais, useMateriais } from '../hooks/useCatalogoFvm';
import { MaterialModal } from '../components/MaterialModal';
import type { FvmMaterial } from '@/services/fvm.service';

export default function CatalogoMateriaisPage() {
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [materialEditando, setMaterialEditando] = useState<FvmMaterial | null | undefined>(undefined);
  // undefined = modal fechado, null = criação, FvmMaterial = edição

  const { data: categorias = [], isLoading: loadingCats } = useCategoriasMateriais();
  const { data: materiais  = [], isLoading: loadingMats } = useMateriais(selectedCatId ?? undefined);

  const selectedCat = categorias.find(c => c.id === selectedCatId) ?? null;

  return (
    <div className="p-6">
      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Catálogo de Materiais</h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            Materiais e checklists de recebimento PBQP-H
          </p>
        </div>
        {selectedCat && (
          <button
            onClick={() => setMaterialEditando(null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Novo Material
          </button>
        )}
      </div>

      {/* ── Layout split: Categorias | Materiais ─────────────────────── */}
      <div className="flex gap-4 h-[calc(100vh-12rem)]">

        {/* Painel de Categorias — idêntico ao CategoriasList do FVS */}
        <div className="w-56 shrink-0 border border-[var(--border-dim)] rounded-lg overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
            <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Categorias</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingCats ? (
              <div className="p-3 flex flex-col gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-8 bg-[var(--bg-raised)] rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Opção "Todos" */}
                <button
                  onClick={() => setSelectedCatId(null)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-sm flex items-center justify-between border-b border-[var(--border-dim)] transition-colors',
                    selectedCatId === null
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-high)] hover:bg-[var(--bg-raised)]',
                  )}
                >
                  <span>Todos</span>
                  <span className={cn('text-xs', selectedCatId === null ? 'text-white/70' : 'text-[var(--text-faint)]')}>
                    {categorias.reduce((acc, c) => acc + (c.total_materiais ?? 0), 0)}
                  </span>
                </button>

                {categorias.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm flex items-center justify-between border-b border-[var(--border-dim)] last:border-0 transition-colors',
                      selectedCatId === cat.id
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-high)] hover:bg-[var(--bg-raised)]',
                    )}
                  >
                    <span className="truncate">{cat.nome}</span>
                    <span className={cn('text-xs shrink-0 ml-1', selectedCatId === cat.id ? 'text-white/70' : 'text-[var(--text-faint)]')}>
                      {cat.total_materiais ?? 0}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Painel de Materiais */}
        <div className="flex-1 border border-[var(--border-dim)] rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--border-dim)] bg-[var(--bg-raised)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
              {selectedCat ? selectedCat.nome : 'Todos os Materiais'}
            </span>
            <span className="text-xs text-[var(--text-faint)]">{materiais.length} materiais</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingMats ? (
              <div className="p-4 flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-[var(--bg-raised)] rounded animate-pulse" />
                ))}
              </div>
            ) : materiais.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <p className="text-sm text-[var(--text-faint)]">
                  {selectedCat
                    ? `Nenhum material em "${selectedCat.nome}".`
                    : 'Selecione uma categoria ou crie o primeiro material.'}
                </p>
                {selectedCat && (
                  <button
                    onClick={() => setMaterialEditando(null)}
                    className="mt-3 text-sm text-[var(--accent)] hover:underline"
                  >
                    + Adicionar material
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                    {['Material', 'Norma', 'Itens', 'Documentos', ''].map(col => (
                      <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materiais.map((mat, i) => (
                    <tr
                      key={mat.id}
                      className={cn(
                        'border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer',
                        i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                      )}
                      onClick={() => setMaterialEditando(mat)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-high)]">{mat.nome}</div>
                        {!selectedCat && (
                          <div className="text-xs text-[var(--text-faint)] mt-0.5">{mat.categoria_nome}</div>
                        )}
                        <div className="flex gap-1.5 mt-1">
                          {mat.exige_certificado && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded">CQ</span>
                          )}
                          {mat.exige_laudo_ensaio && (
                            <span className="text-[10px] bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)] px-1 py-0.5 rounded">Laudo</span>
                          )}
                          {mat.prazo_quarentena_dias > 0 && (
                            <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-1 py-0.5 rounded">
                              Quarentena {mat.prazo_quarentena_dias}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-faint)]">
                        {mat.norma_referencia ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-high)] font-mono">
                        {mat.total_itens ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-high)] font-mono">
                        {mat.total_documentos ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight size={14} className="text-[var(--text-faint)] ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Material */}
      {materialEditando !== undefined && (
        <MaterialModal
          material={materialEditando}
          categoriaId={selectedCatId}
          onClose={() => setMaterialEditando(undefined)}
        />
      )}
    </div>
  );
}
