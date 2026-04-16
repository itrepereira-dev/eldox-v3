# Obras Frontend — Completar Módulo (G1–G8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 8 gaps de frontend que faltam para o módulo de Obras atingir 100% de completude.

**Architecture:** Todos os 8 gaps são mudanças puramente de frontend — todos os endpoints de backend já existem. Novos componentes são criados em arquivos separados quando crescem o suficiente para poluir o arquivo pai.

**Tech Stack:** React 19 + TypeScript + @tanstack/react-query v5 + react-router-dom v7 + Vite + inline styles (não usa Tailwind — padrão estabelecido nas páginas de obras)

---

## Referências dos endpoints existentes

| Endpoint | Usado em |
|---|---|
| `PUT /api/v1/obras/:id` | G1 — editar obra |
| `PUT /api/v1/obras/:id/locais/:localId` | G4 — renomear, G8 — reordenar |
| `PATCH /api/v1/obras/:id/niveis-config` | G7 — reconfigurar hierarquia |
| `GET /api/v1/obras?page=N&limit=20` | G3 — paginação |

---

## Mapa de arquivos

**Modificados:**
- `frontend-web/src/pages/obras/ObrasListPage.tsx` — G3 (paginação), G5 (filtro ENTREGUE)
- `frontend-web/src/pages/obras/ObraDetalhePage.tsx` — G1 (editar obra), G4 (renomear local), G7 (reconfigurar hierarquia), G8 (reordenar)
- `frontend-web/src/pages/obras/CadastroObraWizard.tsx` — G2 (formulário multi-nível genérica), G6 (ativar estratégias)

**Criados:**
- `frontend-web/src/pages/obras/EditarObraModal.tsx` — modal de edição de obra (G1)
- `frontend-web/src/pages/obras/estrategias/EdificacaoForm.tsx` — form edificação (G6)
- `frontend-web/src/pages/obras/estrategias/LinearForm.tsx` — form linear (G6)
- `frontend-web/src/pages/obras/estrategias/InstalacaoForm.tsx` — form instalação (G6)

---

## Task 1: G5 — Filtro "ENTREGUE" na listagem

**Files:**
- Modify: `frontend-web/src/pages/obras/ObrasListPage.tsx:74`

- [ ] **Step 1: Adicionar 'ENTREGUE' ao array de filtros**

Em `ObrasListPage.tsx`, linha 74, substituir:
```tsx
{['', 'PLANEJAMENTO', 'EM_EXECUCAO', 'PARALISADA', 'CONCLUIDA'].map((s) => (
```
por:
```tsx
{['', 'PLANEJAMENTO', 'EM_EXECUCAO', 'PARALISADA', 'CONCLUIDA', 'ENTREGUE'].map((s) => (
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
git add src/pages/obras/ObrasListPage.tsx
git commit -m "feat(obras): add ENTREGUE status filter to list page"
```

---

## Task 2: G3 — Paginação na listagem

**Files:**
- Modify: `frontend-web/src/pages/obras/ObrasListPage.tsx`

O backend já retorna `{ items, total, page, totalPages }`. O frontend já acessa `data?.items` e `data?.total`. Faltam: state de página, passar `page` ao query, controles de navegação.

- [ ] **Step 1: Adicionar state de página e atualizar query**

Após `const [confirmRemover, setConfirmRemover] = useState...` (linha 26), adicionar:
```tsx
const [page, setPage] = useState(1);
```

Adicionar helper que reseta a página ao trocar filtro (substitui o `onClick={() => setStatusFiltro(s)}` inline, linha 76):
```tsx
const handleSetFiltro = (s: string) => {
  setStatusFiltro(s);
  setPage(1);
};
```

Atualizar `useQuery` (linhas 28-31):
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['obras', statusFiltro, page],
  queryFn: () => obrasService.getAll({ status: statusFiltro || undefined, page, limit: 20 }),
});
```

No JSX dos filtros, trocar `onClick={() => setStatusFiltro(s)}` por `onClick={() => handleSetFiltro(s)}`.

- [ ] **Step 2: Adicionar controles de paginação após o grid**

Logo após o `</div>` do grid (linha 138) e antes do modal de confirmação, adicionar:
```tsx
{/* Paginação */}
{data && (data.totalPages ?? 1) > 1 && (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
    <button
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={page === 1}
      style={{
        padding: '7px 14px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--bg-border)',
        background: page === 1 ? 'var(--bg-void)' : 'var(--bg-elevated)',
        color: page === 1 ? 'var(--text-40)' : 'var(--text-80)',
        cursor: page === 1 ? 'default' : 'pointer', fontSize: '13px',
      }}
    >
      ← Anterior
    </button>
    <span style={{ fontSize: '13px', color: 'var(--text-60)' }}>
      Página {page} de {data.totalPages ?? 1}
    </span>
    <button
      onClick={() => setPage((p) => Math.min(data.totalPages ?? 1, p + 1))}
      disabled={page === (data.totalPages ?? 1)}
      style={{
        padding: '7px 14px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--bg-border)',
        background: page === (data.totalPages ?? 1) ? 'var(--bg-void)' : 'var(--bg-elevated)',
        color: page === (data.totalPages ?? 1) ? 'var(--text-40)' : 'var(--text-80)',
        cursor: page === (data.totalPages ?? 1) ? 'default' : 'pointer', fontSize: '13px',
      }}
    >
      Próxima →
    </button>
  </div>
)}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros. O tipo de `data` é `any` (retorno não tipado de `obrasService.getAll`), então `data.totalPages` compila sem ajuste de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/pages/obras/ObrasListPage.tsx
git commit -m "feat(obras): add pagination controls to list page"
```

---

## Task 3: G1 — Modal de edição da obra

**Files:**
- Create: `frontend-web/src/pages/obras/EditarObraModal.tsx`
- Modify: `frontend-web/src/pages/obras/ObraDetalhePage.tsx`

O `PUT /obras/:id` aceita todos os campos de `CreateObraDto` (parciais) + `status`. O CEP deve estar no formato `NNNNN-NNN` se preenchido (validação do backend).

- [ ] **Step 1: Criar EditarObraModal.tsx**

Criar o arquivo `frontend-web/src/pages/obras/EditarObraModal.tsx` com o conteúdo:

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { obrasService, type ObraDetalhe } from '../../services/obras.service';

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

const STATUS_OPTIONS = [
  { value: 'PLANEJAMENTO', label: 'Planejamento' },
  { value: 'EM_EXECUCAO', label: 'Em Execução' },
  { value: 'PARALISADA', label: 'Paralisada' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'ENTREGUE', label: 'Entregue' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 12px',
  color: 'var(--text-100)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export function EditarObraModal({
  obra,
  onClose,
}: {
  obra: ObraDetalhe;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nome: obra.nome,
    status: obra.status,
    modoQualidade: obra.modoQualidade,
    endereco: obra.endereco ?? '',
    cidade: obra.cidade ?? '',
    estado: obra.estado ?? '',
    cep: obra.cep ?? '',
    dataInicioPrevista: obra.dataInicioPrevista ? obra.dataInicioPrevista.slice(0, 10) : '',
    dataFimPrevista: obra.dataFimPrevista ? obra.dataFimPrevista.slice(0, 10) : '',
  });
  const [erro, setErro] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErro('');
  };

  const salvarMutation = useMutation({
    mutationFn: () =>
      obrasService.update(obra.id, {
        nome: form.nome.trim(),
        status: form.status as any,
        modoQualidade: form.modoQualidade,
        endereco: form.endereco.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        estado: form.estado || undefined,
        cep: form.cep.trim() || undefined,
        dataInicioPrevista: form.dataInicioPrevista || undefined,
        dataFimPrevista: form.dataFimPrevista || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra', obra.id] });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      onClose();
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao salvar alterações');
    },
  });

  const podesSalvar = form.nome.trim().length >= 2;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)', padding: '28px',
          width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>
          Editar Obra
        </h2>

        {erro && (
          <div style={{
            background: 'rgba(255,61,87,0.1)', border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px',
          }}>
            {erro}
          </div>
        )}

        {/* Nome */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>
            Nome da Obra *
          </label>
          <input value={form.nome} onChange={(e) => set('nome', e.target.value)} style={inputStyle} autoFocus />
        </div>

        {/* Status + Modo Qualidade */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value as any)} style={inputStyle}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Modo de Qualidade</label>
            <select value={form.modoQualidade} onChange={(e) => set('modoQualidade', e.target.value as any)} style={inputStyle}>
              <option value="SIMPLES">Simples</option>
              <option value="PBQPH">PBQP-H</option>
            </select>
          </div>
        </div>

        {/* Endereço */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Endereço</label>
          <input
            value={form.endereco}
            onChange={(e) => set('endereco', e.target.value)}
            placeholder="Rua, número, bairro"
            style={inputStyle}
          />
        </div>

        {/* Cidade + Estado + CEP */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 130px', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Cidade</label>
            <input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Estado</label>
            <select value={form.estado} onChange={(e) => set('estado', e.target.value)} style={{ ...inputStyle, width: '72px' }}>
              <option value="">UF</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>CEP</label>
            <input
              value={form.cep}
              onChange={(e) => set('cep', e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Datas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Início Previsto</label>
            <input type="date" value={form.dataInicioPrevista} onChange={(e) => set('dataInicioPrevista', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '6px' }}>Término Previsto</label>
            <input type="date" value={form.dataFimPrevista} onChange={(e) => set('dataFimPrevista', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={salvarMutation.isPending}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
              padding: '9px 18px', cursor: 'pointer', fontSize: '14px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => salvarMutation.mutate()}
            disabled={!podesSalvar || salvarMutation.isPending}
            style={{
              background: podesSalvar ? 'var(--accent)' : 'var(--bg-border)',
              color: podesSalvar ? '#000' : 'var(--text-40)',
              border: 'none', borderRadius: 'var(--radius-md)',
              padding: '9px 20px', cursor: podesSalvar ? 'pointer' : 'default',
              fontSize: '14px', fontWeight: 600,
            }}
          >
            {salvarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar botão "Editar" e estado no ObraDetalhePage**

Em `ObraDetalhePage.tsx`, adicionar o import no topo (linha 1, após os outros imports):
```tsx
import { EditarObraModal } from './EditarObraModal';
```

Adicionar estado após `const [abaAtiva, setAbaAtiva] = useState<'locais' | 'templates'>('locais');` (linha 81):
```tsx
const [editandoObra, setEditandoObra] = useState(false);
```

Substituir o `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>` (linhas 123-144) pelo bloco completo com botão:
```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--text-40)' }}>
        {obra.codigo}
      </span>
      {obra.modoQualidade === 'PBQPH' && (
        <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)' }}>
          PBQP-H
        </span>
      )}
      <span style={{ fontSize: '12px', color: 'var(--status-success)' }}>
        ● {STATUS_OBRA_LABEL[obra.status] ?? obra.status}
      </span>
    </div>
    <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{obra.nome}</h1>
    <p style={{ color: 'var(--text-60)', fontSize: '14px', marginTop: '4px' }}>
      {obra.obraTipo.nome}
      {obra.cidade && ` · ${obra.cidade}${obra.estado ? `/${obra.estado}` : ''}`}
    </p>
  </div>
  <button
    onClick={() => setEditandoObra(true)}
    style={{
      background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
      color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
      padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
    }}
  >
    Editar
  </button>
</div>
```

Antes do `</div>` final do return (última linha antes do `)`):
```tsx
{editandoObra && (
  <EditarObraModal obra={obra} onClose={() => setEditandoObra(false)} />
)}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/pages/obras/EditarObraModal.tsx src/pages/obras/ObraDetalhePage.tsx
git commit -m "feat(obras): add edit obra modal with all editable fields"
```

---

## Task 4: G4 + G8 — Renomear local e Reordenar locais

**Files:**
- Modify: `frontend-web/src/pages/obras/ObraDetalhePage.tsx`

Estas duas tasks são implementadas juntas porque ambas modificam `LocalRow`. Implementar as duas de uma vez evita dois rewrites do mesmo componente.

- [ ] **Step 1: Adicionar mutações de renomear e reordenar**

Após `removerLocalMutation` (linha 74 aprox.), adicionar:
```tsx
const renomearLocalMutation = useMutation({
  mutationFn: ({ localId, nome }: { localId: number; nome: string }) =>
    obrasService.updateLocal(obraId, localId, { nome }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
  },
});

const reordenarLocalMutation = useMutation({
  mutationFn: ({ localId, ordem }: { localId: number; ordem: number }) =>
    obrasService.updateLocal(obraId, localId, { ordem }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['obra-locais', obraId] });
  },
});
```

- [ ] **Step 2: Atualizar locais.map para passar novos callbacks**

Substituir o `locais.map(...)` existente (linhas 393-403 aprox.):
```tsx
{locais.map((local, i) => (
  <LocalRow
    key={local.id}
    local={local}
    isLast={i === locais.length - 1}
    podeEntrar={nivelAtual < totalNiveis}
    onEntrar={() => entrarLocal(local)}
    onRemover={() => removerLocalMutation.mutate(local.id)}
    onRenomear={(nome) => renomearLocalMutation.mutate({ localId: local.id, nome })}
    podeSubir={i > 0}
    podeDescer={i < locais.length - 1}
    onSubir={() => {
      const acima = locais[i - 1];
      reordenarLocalMutation.mutate({ localId: local.id, ordem: acima.ordem });
      reordenarLocalMutation.mutate({ localId: acima.id, ordem: local.ordem });
    }}
    onDescer={() => {
      const abaixo = locais[i + 1];
      reordenarLocalMutation.mutate({ localId: local.id, ordem: abaixo.ordem });
      reordenarLocalMutation.mutate({ localId: abaixo.id, ordem: local.ordem });
    }}
  />
))}
```

- [ ] **Step 3: Substituir LocalRow pelo componente completo com rename e reorder**

Substituir toda a função `LocalRow` (linhas 464–526 aprox.) por:
```tsx
function LocalRow({
  local,
  isLast,
  podeEntrar,
  onEntrar,
  onRemover,
  onRenomear,
  podeSubir,
  podeDescer,
  onSubir,
  onDescer,
}: {
  local: ObraLocal;
  isLast: boolean;
  podeEntrar: boolean;
  onEntrar: () => void;
  onRemover: () => void;
  onRenomear: (nome: string) => void;
  podeSubir: boolean;
  podeDescer: boolean;
  onSubir: () => void;
  onDescer: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(local.nome);

  const confirmarRename = () => {
    const trimmed = nomeEdit.trim();
    if (trimmed && trimmed !== local.nome) onRenomear(trimmed);
    setEditando(false);
  };

  if (editando) {
    return (
      <div
        style={{
          padding: '10px 20px',
          borderBottom: isLast ? 'none' : '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-surface)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-40)', minWidth: '100px' }}>
          {local.codigo}
        </span>
        <input
          autoFocus
          value={nomeEdit}
          onChange={(e) => setNomeEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarRename();
            if (e.key === 'Escape') { setNomeEdit(local.nome); setEditando(false); }
          }}
          style={{
            flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px',
            color: 'var(--text-100)', fontSize: '14px', outline: 'none',
          }}
        />
        <button onClick={confirmarRename}
          style={{
            background: 'var(--accent)', border: 'none', color: '#000',
            borderRadius: 'var(--radius-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '13px',
          }}>
          OK
        </button>
        <button onClick={() => { setNomeEdit(local.nome); setEditando(false); }}
          style={{
            background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-60)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', fontSize: '13px',
          }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '14px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--bg-border)',
        display: 'flex', alignItems: 'center', gap: '12px',
        cursor: podeEntrar ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (podeEntrar) e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={podeEntrar ? onEntrar : undefined}
    >
      <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-40)', minWidth: '100px' }}>
        {local.codigo}
      </span>
      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-100)' }}>
        {local.nome}
      </span>
      {local.totalFilhos > 0 && (
        <span style={{ fontSize: '12px', color: 'var(--text-60)' }}>
          {local.totalFilhos} sub{local.totalFilhos !== 1 ? 'itens' : 'item'}
        </span>
      )}
      {podeEntrar && (
        <span style={{ fontSize: '14px', color: 'var(--text-40)' }}>›</span>
      )}
      {/* Botões reordenar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (podeSubir) onSubir(); }}
          disabled={!podeSubir}
          style={{
            background: 'none', border: 'none', padding: '1px 4px',
            cursor: podeSubir ? 'pointer' : 'default',
            color: podeSubir ? 'var(--text-40)' : 'transparent',
            fontSize: '10px', lineHeight: 1,
          }}
          title="Mover para cima"
        >
          ▲
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (podeDescer) onDescer(); }}
          disabled={!podeDescer}
          style={{
            background: 'none', border: 'none', padding: '1px 4px',
            cursor: podeDescer ? 'pointer' : 'default',
            color: podeDescer ? 'var(--text-40)' : 'transparent',
            fontSize: '10px', lineHeight: 1,
          }}
          title="Mover para baixo"
        >
          ▼
        </button>
      </div>
      {/* Botão renomear */}
      <button
        onClick={(e) => { e.stopPropagation(); setEditando(true); }}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-40)',
          cursor: 'pointer', fontSize: '13px', padding: '0 4px', opacity: 0.5,
        }}
        title="Renomear"
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
      >
        ✎
      </button>
      {/* Botão remover */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemover(); }}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-40)',
          cursor: 'pointer', fontSize: '16px', padding: '0 4px', opacity: 0.5,
        }}
        title="Remover"
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/pages/obras/ObraDetalhePage.tsx
git commit -m "feat(obras): add inline rename and up/down reorder for locais"
```

---

## Task 5: G7 — Reconfigurar hierarquia pós-wizard

**Files:**
- Modify: `frontend-web/src/pages/obras/ObraDetalhePage.tsx`

Adiciona modal para renomear os rótulos dos níveis de hierarquia da obra já criada, chamando `PATCH /obras/:id/niveis-config`.

- [ ] **Step 1: Adicionar estado e mutação para hierarquia**

Após `const [editandoObra, setEditandoObra] = useState(false);`, adicionar:
```tsx
const [editandoHierarquia, setEditandoHierarquia] = useState(false);
const [niveisEditados, setNiveisEditados] = useState<
  { nivel: number; labelSingular: string; labelPlural: string }[]
>([]);

const salvarHierarquiaMutation = useMutation({
  mutationFn: () => obrasService.saveNiveisConfig(obraId, niveisEditados),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
    setEditandoHierarquia(false);
  },
});

const abrirEditarHierarquia = () => {
  setNiveisEditados(
    obra.niveisConfig.map((n) => ({
      nivel: n.nivel,
      labelSingular: n.labelSingular,
      labelPlural: n.labelPlural,
    })),
  );
  setEditandoHierarquia(true);
};
```

- [ ] **Step 2: Adicionar botão "Hierarquia" no header da seção de locais**

Substituir o `<div style={{ display: 'flex', gap: '8px' }}>` que contém os botões "Gerar em massa" e "+ Nível" (dentro do `{nivelAtual <= totalNiveis && ...}`, linhas 252-276), pelo bloco com o botão adicional:
```tsx
<div style={{ display: 'flex', gap: '8px' }}>
  <button
    onClick={abrirEditarHierarquia}
    style={{
      background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
      color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
      padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
    }}
    title="Renomear níveis de hierarquia"
  >
    Hierarquia
  </button>
  {nivelAtual <= totalNiveis && (
    <>
      <button
        onClick={() => setGerandoMassa(true)}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
        }}
      >
        Gerar em massa
      </button>
      <button
        onClick={() => setAdicionando(true)}
        style={{
          background: 'var(--accent)', border: 'none',
          color: '#000', borderRadius: 'var(--radius-md)',
          padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
        }}
      >
        + {labelNivel}
      </button>
    </>
  )}
</div>
```

Obs: O botão "Hierarquia" fica fora do `{nivelAtual <= totalNiveis && ...}` para aparecer sempre, independente do nível atual.

- [ ] **Step 3: Renderizar o modal de hierarquia**

Após o `{editandoObra && ...}` no final do return, adicionar:
```tsx
{editandoHierarquia && (
  <div
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) setEditandoHierarquia(false); }}
  >
    <div
      style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)', padding: '28px',
        width: '480px', maxWidth: '95vw',
      }}
    >
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
        Configurar Hierarquia de Locais
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-60)', marginBottom: '20px' }}>
        Renomeie os rótulos dos níveis de hierarquia desta obra.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {niveisEditados.map((n, i) => (
          <div key={n.nivel} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 600, color: 'var(--text-60)',
            }}>
              {n.nivel}
            </span>
            <input
              value={n.labelSingular}
              onChange={(e) => {
                const val = e.target.value;
                setNiveisEditados((prev) =>
                  prev.map((x, j) => j === i ? { ...x, labelSingular: val, labelPlural: val } : x),
                );
              }}
              placeholder={`Nome do nível ${n.nivel} — ex: Torre, Pavimento, Apartamento`}
              style={{
                flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)', padding: '9px 12px',
                color: 'var(--text-100)', fontSize: '14px', outline: 'none',
              }}
              autoFocus={i === 0}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setEditandoHierarquia(false)}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
            padding: '9px 18px', cursor: 'pointer', fontSize: '14px',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => salvarHierarquiaMutation.mutate()}
          disabled={
            salvarHierarquiaMutation.isPending ||
            niveisEditados.some((n) => !n.labelSingular.trim())
          }
          style={{
            background: 'var(--accent)', color: '#000', border: 'none',
            borderRadius: 'var(--radius-md)', padding: '9px 20px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}
        >
          {salvarHierarquiaMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/pages/obras/ObraDetalhePage.tsx
git commit -m "feat(obras): add hierarchy reconfiguration modal in obra detalhe"
```

---

## Task 6: G2 — Formulário multi-nível Genérica no wizard

**Files:**
- Modify: `frontend-web/src/pages/obras/CadastroObraWizard.tsx`

Substituir o formulário simples (prefixo + qtde) da estratégia Genérica por um formulário dinâmico de níveis, usando o endpoint `POST /obras/:id/locais/gerar-cascata` com payload correto.

- [ ] **Step 1: Adicionar state de multiNiveis**

Após `const [estrategia, setEstrategia] = useState<EstrategiaGeracao | null>(null);` (linha 55):
```tsx
const [multiNiveis, setMultiNiveis] = useState<{ nivel: number; prefixo: string; qtde: number }[]>([
  { nivel: 1, prefixo: '', qtde: 1 },
]);
```

- [ ] **Step 2: Adicionar helpers para gerenciar níveis**

Após `const set = <K extends keyof WizardState>...` (linha 143 aprox.):
```tsx
const adicionarNivelGenerica = () => {
  setMultiNiveis((prev) => [
    ...prev,
    { nivel: prev.length + 1, prefixo: '', qtde: 1 },
  ]);
};

const removerUltimoNivelGenerica = () => {
  if (multiNiveis.length > 1) {
    setMultiNiveis((prev) => prev.slice(0, -1));
  }
};

const atualizarNivelGenerica = (
  idx: number,
  campo: 'prefixo' | 'qtde',
  valor: string | number,
) => {
  setMultiNiveis((prev) =>
    prev.map((n, i) => (i === idx ? { ...n, [campo]: valor } : n)),
  );
};
```

- [ ] **Step 3: Atualizar gerarCascataGenericaMutation para usar multiNiveis**

Substituir o `gerarCascataGenericaMutation` existente (linhas 128-139):
```tsx
const gerarCascataGenericaMutation = useMutation({
  mutationFn: () =>
    obrasService.gerarCascata(obraCriada!.id, 'generica', {
      niveis: multiNiveis.map((n) => ({
        nivel: n.nivel,
        qtde: n.qtde,
        prefixo: n.prefixo,
      })),
    }),
  onSuccess: () => {
    navigate(`/obras/${obraCriada!.id}`);
  },
  onError: (err: any) => {
    setErro(err?.response?.data?.message ?? 'Erro ao gerar locais em cascata');
  },
});
```

- [ ] **Step 4: Substituir formulário simples por formulário multi-nível**

Substituir o bloco `{state.gerarLocais && (...)}` na Etapa 3 (linhas 545-586 aprox.) por:
```tsx
{state.gerarLocais && estrategia === 'generica' && (
  <div style={{ marginTop: '20px' }}>
    <p style={{ fontSize: '13px', color: 'var(--text-60)', marginBottom: '12px' }}>
      Configure a hierarquia de locais a gerar. Cada linha é um nível.
    </p>

    {/* Cabeçalho da tabela */}
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 36px', gap: '8px', marginBottom: '6px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-40)' }}>Nív.</span>
      <span style={{ fontSize: '11px', color: 'var(--text-40)' }}>Prefixo</span>
      <span style={{ fontSize: '11px', color: 'var(--text-40)' }}>Qtde</span>
      <span />
    </div>

    {multiNiveis.map((n, i) => (
      <div
        key={i}
        style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 100px 36px',
          gap: '8px', marginBottom: '8px', alignItems: 'center',
        }}
      >
        <span style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 600, color: 'var(--text-60)',
        }}>
          {n.nivel}
        </span>
        <input
          value={n.prefixo}
          onChange={(e) => atualizarNivelGenerica(i, 'prefixo', e.target.value)}
          placeholder={state.niveisConfig[i]?.labelSingular || `Nível ${n.nivel}`}
          style={inputStyle}
          autoFocus={i === 0}
        />
        <input
          type="number"
          min={1}
          max={500}
          value={n.qtde}
          onChange={(e) => atualizarNivelGenerica(i, 'qtde', parseInt(e.target.value) || 1)}
          style={inputStyle}
        />
        <button
          onClick={removerUltimoNivelGenerica}
          disabled={i !== multiNiveis.length - 1 || multiNiveis.length === 1}
          style={{
            background: 'none', border: 'none',
            color: i === multiNiveis.length - 1 && multiNiveis.length > 1 ? 'var(--text-40)' : 'transparent',
            cursor: i === multiNiveis.length - 1 && multiNiveis.length > 1 ? 'pointer' : 'default',
            fontSize: '18px',
          }}
          title="Remover nível"
        >
          ×
        </button>
      </div>
    ))}

    {/* Botão adicionar nível */}
    {multiNiveis.length < (state.totalNiveis ?? 6) && (
      <button
        onClick={adicionarNivelGenerica}
        style={{
          background: 'transparent', border: '1px dashed var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '7px 14px', cursor: 'pointer', fontSize: '13px', width: '100%',
          marginBottom: '12px',
        }}
      >
        + Adicionar nível
      </button>
    )}

    {/* Preview */}
    {multiNiveis.some((n) => n.prefixo.trim()) && (
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px',
        fontSize: '12px', color: 'var(--text-60)',
      }}>
        Exemplo: {multiNiveis.map((n) => `${n.prefixo.trim() || `N${n.nivel}`} 01`).join(' › ')}
        {' '}· total último nível ≈{' '}
        <strong style={{ color: 'var(--text-80)' }}>
          {multiNiveis.reduce((acc, n) => acc * n.qtde, 1).toLocaleString('pt-BR')}
        </strong>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Atualizar BotoesWizard no final da Etapa 3**

Substituir o `<BotoesWizard ...>` da Etapa 3 (linhas 588-600 aprox.) por:
```tsx
<BotoesWizard
  onVoltar={() => setEtapa(2)}
  onAvancar={
    !state.gerarLocais
      ? handleFinalizarSemLocais
      : estrategia === 'generica'
      ? () => gerarCascataGenericaMutation.mutate()
      : handleFinalizarSemLocais
  }
  carregando={gerarCascataGenericaMutation.isPending}
  podeAvancar={
    !state.gerarLocais ||
    (estrategia !== null &&
      (estrategia !== 'generica' ||
        multiNiveis.every((n) => n.prefixo.trim().length > 0 && n.qtde > 0)))
  }
  labelAvancar={state.gerarLocais ? 'Gerar Locais e Finalizar' : 'Finalizar Cadastro'}
/>
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

- [ ] **Step 7: Commit**

```bash
git add src/pages/obras/CadastroObraWizard.tsx
git commit -m "feat(obras): replace simple gerar locais with multi-level generica cascade form"
```

---

## Task 7: G6 — Forms Edificação, Linear e Instalação

**Files:**
- Create: `frontend-web/src/pages/obras/estrategias/EdificacaoForm.tsx`
- Create: `frontend-web/src/pages/obras/estrategias/LinearForm.tsx`
- Create: `frontend-web/src/pages/obras/estrategias/InstalacaoForm.tsx`
- Modify: `frontend-web/src/pages/obras/CadastroObraWizard.tsx`

- [ ] **Step 1: Criar diretório estrategias**

```bash
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/pages/obras/estrategias"
```

- [ ] **Step 2: Criar EdificacaoForm.tsx**

Criar `frontend-web/src/pages/obras/estrategias/EdificacaoForm.tsx`:

```tsx
import { useState } from 'react';

export interface EdificacaoPayload {
  condominios: number;
  condInicio: number;
  blocos: number;
  blocoLabel: 'letra' | 'numero';
  andarQtd: number;
  andarInicio: number;
  unidadesPorAndar: number;
  modoUnidade: 'andar' | 'sequencial';
  areasComuns: string[];
  areasGlobais: string[];
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '8px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function TagList({ items, placeholder, onChange }: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const adicionar = () => {
    const v = input.trim();
    if (v && !items.includes(v)) { onChange([...items, v]); setInput(''); }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder={placeholder} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={adicionar} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
        }}>+</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {items.map((item) => (
            <span key={item} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)', padding: '3px 8px',
              fontSize: '12px', color: 'var(--text-80)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              {item}
              <button onClick={() => onChange(items.filter((i) => i !== item))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '14px', padding: '0' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EdificacaoForm({ value, onChange }: {
  value: EdificacaoPayload;
  onChange: (v: EdificacaoPayload) => void;
}) {
  const set = <K extends keyof EdificacaoPayload>(key: K, val: EdificacaoPayload[K]) =>
    onChange({ ...value, [key]: val });

  const totalUnidades = value.condominios * value.blocos * value.andarQtd * value.unidadesPorAndar;

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Condomínios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Nº de condomínios</label>
          <input type="number" min={1} max={20} value={value.condominios}
            onChange={(e) => set('condominios', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Início da numeração</label>
          <input type="number" min={1} value={value.condInicio}
            onChange={(e) => set('condInicio', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
      </div>

      {/* Blocos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Nº de blocos por condomínio</label>
          <input type="number" min={1} max={26} value={value.blocos}
            onChange={(e) => set('blocos', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Rótulo do bloco</label>
          <select value={value.blocoLabel} onChange={(e) => set('blocoLabel', e.target.value as any)} style={inputStyle}>
            <option value="letra">Letra (A, B, C…)</option>
            <option value="numero">Número (1, 2, 3…)</option>
          </select>
        </div>
      </div>

      {/* Andares */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Andares por bloco</label>
          <input type="number" min={0} max={200} value={value.andarQtd}
            onChange={(e) => set('andarQtd', parseInt(e.target.value) || 0)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Andar inicial</label>
          <input type="number" min={0} value={value.andarInicio}
            onChange={(e) => set('andarInicio', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
      </div>

      {/* Unidades */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Unidades por andar</label>
          <input type="number" min={1} max={100} value={value.unidadesPorAndar}
            onChange={(e) => set('unidadesPorAndar', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Numeração das unidades</label>
          <select value={value.modoUnidade} onChange={(e) => set('modoUnidade', e.target.value as any)} style={inputStyle}>
            <option value="andar">Por andar (101, 201…)</option>
            <option value="sequencial">Sequencial (01, 02…)</option>
          </select>
        </div>
      </div>

      {/* Áreas */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Áreas comuns (por bloco) — opcional</label>
        <TagList items={value.areasComuns} placeholder="Ex: Garagem, Salão de Festas"
          onChange={(items) => set('areasComuns', items)} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Áreas globais (condomínio) — opcional</label>
        <TagList items={value.areasGlobais} placeholder="Ex: Portaria, Guarita"
          onChange={(items) => set('areasGlobais', items)} />
      </div>

      {/* Preview */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px',
        fontSize: '12px', color: 'var(--text-60)',
      }}>
        Estimativa: <strong style={{ color: 'var(--text-80)' }}>{totalUnidades.toLocaleString('pt-BR')}</strong> unidades
        {value.condominios > 1 && ` em ${value.condominios} condomínios`}
        {value.areasComuns.length > 0 && ` + ${value.areasComuns.length} área(s) comum(ns) por bloco`}
        {value.areasGlobais.length > 0 && ` + ${value.areasGlobais.length} área(s) global(is)`}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar LinearForm.tsx**

Criar `frontend-web/src/pages/obras/estrategias/LinearForm.tsx`:

```tsx
export interface TrechoConfig {
  nome: string;
  kmInicio: number;
  kmFim: number;
  intervaloKm: number;
  elementoLabel: string;
}

export interface LinearPayload {
  trechos: TrechoConfig[];
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '7px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function TrechoRow({ trecho, index, total, onChange, onRemover }: {
  trecho: TrechoConfig;
  index: number;
  total: number;
  onChange: (t: TrechoConfig) => void;
  onRemover: () => void;
}) {
  const extensao = trecho.kmFim - trecho.kmInicio;
  const pvs = extensao > 0 && trecho.intervaloKm > 0
    ? Math.floor(extensao / trecho.intervaloKm) + 1 : 0;

  return (
    <div style={{
      border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
      padding: '14px', marginBottom: '10px', background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-80)' }}>Trecho {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemover}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '16px' }}>
            ×
          </button>
        )}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Nome</label>
        <input value={trecho.nome} onChange={(e) => onChange({ ...trecho, nome: e.target.value })}
          placeholder="Ex: Trecho Centro — Norte" style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '6px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>km Início</label>
          <input type="number" step="0.01" min={0} value={trecho.kmInicio}
            onChange={(e) => onChange({ ...trecho, kmInicio: parseFloat(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>km Fim</label>
          <input type="number" step="0.01" min={0} value={trecho.kmFim}
            onChange={(e) => onChange({ ...trecho, kmFim: parseFloat(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Intervalo (km)</label>
          <input type="number" step="0.1" min={0.1} value={trecho.intervaloKm}
            onChange={(e) => onChange({ ...trecho, intervaloKm: parseFloat(e.target.value) || 0.1 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Rótulo</label>
          <input value={trecho.elementoLabel}
            onChange={(e) => onChange({ ...trecho, elementoLabel: e.target.value })}
            placeholder="PV" style={inputStyle} />
        </div>
      </div>
      {pvs > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-60)' }}>
          → {pvs} {trecho.elementoLabel || 'PV'}(s) a cada {trecho.intervaloKm} km
        </div>
      )}
    </div>
  );
}

export function LinearForm({ value, onChange }: {
  value: LinearPayload;
  onChange: (v: LinearPayload) => void;
}) {
  const updateTrecho = (i: number, t: TrechoConfig) =>
    onChange({ trechos: value.trechos.map((tr, idx) => (idx === i ? t : tr)) });

  const removerTrecho = (i: number) =>
    onChange({ trechos: value.trechos.filter((_, idx) => idx !== i) });

  const adicionarTrecho = () => {
    const ultimo = value.trechos[value.trechos.length - 1];
    onChange({
      trechos: [
        ...value.trechos,
        {
          nome: '',
          kmInicio: ultimo?.kmFim ?? 0,
          kmFim: (ultimo?.kmFim ?? 0) + 5,
          intervaloKm: ultimo?.intervaloKm ?? 0.5,
          elementoLabel: ultimo?.elementoLabel ?? 'PV',
        },
      ],
    });
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {value.trechos.map((t, i) => (
        <TrechoRow key={i} trecho={t} index={i} total={value.trechos.length}
          onChange={(t) => updateTrecho(i, t)} onRemover={() => removerTrecho(i)} />
      ))}
      <button onClick={adicionarTrecho}
        style={{
          background: 'transparent', border: '1px dashed var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '8px', cursor: 'pointer', fontSize: '13px', width: '100%',
        }}>
        + Adicionar trecho
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Criar InstalacaoForm.tsx**

Criar `frontend-web/src/pages/obras/estrategias/InstalacaoForm.tsx`:

```tsx
import { useState } from 'react';

export interface AreaConfig {
  nome: string;
  modulosQtde: number;
  modulosNomes: string[];
  modoModulo: 'qtde' | 'nomes';
}

export interface InstalacaoPayload {
  areas: AreaConfig[];
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '7px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function AreaRow({ area, index, total, onChange, onRemover }: {
  area: AreaConfig;
  index: number;
  total: number;
  onChange: (a: AreaConfig) => void;
  onRemover: () => void;
}) {
  const [novoModulo, setNovoModulo] = useState('');

  const adicionarModulo = () => {
    const v = novoModulo.trim();
    if (v && !area.modulosNomes.includes(v)) {
      onChange({ ...area, modulosNomes: [...area.modulosNomes, v] });
      setNovoModulo('');
    }
  };

  return (
    <div style={{
      border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
      padding: '14px', marginBottom: '10px', background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-80)' }}>Área {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemover}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '16px' }}>
            ×
          </button>
        )}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Nome da área</label>
        <input value={area.nome} onChange={(e) => onChange({ ...area, nome: e.target.value })}
          placeholder="Ex: Galpão A, Caldeiraria, Utilidades" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {(['qtde', 'nomes'] as const).map((modo) => (
          <button key={modo} onClick={() => onChange({ ...area, modoModulo: modo })}
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${area.modoModulo === modo ? 'var(--accent)' : 'var(--bg-border)'}`,
              background: area.modoModulo === modo ? 'var(--accent-dim)' : 'transparent',
              color: area.modoModulo === modo ? 'var(--accent)' : 'var(--text-60)',
              cursor: 'pointer', fontSize: '12px',
            }}>
            {modo === 'qtde' ? 'Por quantidade' : 'Por nome'}
          </button>
        ))}
      </div>
      {area.modoModulo === 'qtde' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="number" min={1} max={500} value={area.modulosQtde}
            onChange={(e) => onChange({ ...area, modulosQtde: parseInt(e.target.value) || 1 })}
            style={{ ...inputStyle, width: '100px' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-60)' }}>módulos numerados</span>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <input value={novoModulo} onChange={(e) => setNovoModulo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarModulo()}
              placeholder="Ex: Caldeira Principal" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={adicionarModulo}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
                padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
              }}>+</button>
          </div>
          {area.modulosNomes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {area.modulosNomes.map((m) => (
                <span key={m} style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius-sm)', padding: '3px 8px',
                  fontSize: '12px', color: 'var(--text-80)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {m}
                  <button onClick={() => onChange({ ...area, modulosNomes: area.modulosNomes.filter((x) => x !== m) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '14px', padding: '0' }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InstalacaoForm({ value, onChange }: {
  value: InstalacaoPayload;
  onChange: (v: InstalacaoPayload) => void;
}) {
  const updateArea = (i: number, a: AreaConfig) =>
    onChange({ areas: value.areas.map((ar, idx) => (idx === i ? a : ar)) });

  const removerArea = (i: number) =>
    onChange({ areas: value.areas.filter((_, idx) => idx !== i) });

  const adicionarArea = () =>
    onChange({ areas: [...value.areas, { nome: '', modulosQtde: 1, modulosNomes: [], modoModulo: 'qtde' }] });

  return (
    <div style={{ marginTop: '16px' }}>
      {value.areas.map((a, i) => (
        <AreaRow key={i} area={a} index={i} total={value.areas.length}
          onChange={(a) => updateArea(i, a)} onRemover={() => removerArea(i)} />
      ))}
      <button onClick={adicionarArea}
        style={{
          background: 'transparent', border: '1px dashed var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '8px', cursor: 'pointer', fontSize: '13px', width: '100%',
        }}>
        + Adicionar área
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Integrar forms no CadastroObraWizard**

Adicionar imports no topo de `CadastroObraWizard.tsx` (após o import do obrasService):
```tsx
import { EdificacaoForm, type EdificacaoPayload } from './estrategias/EdificacaoForm';
import { LinearForm, type LinearPayload } from './estrategias/LinearForm';
import { InstalacaoForm, type InstalacaoPayload } from './estrategias/InstalacaoForm';
```

Adicionar states para cada payload (após o state de `multiNiveis`):
```tsx
const [edificacaoPayload, setEdificacaoPayload] = useState<EdificacaoPayload>({
  condominios: 1, condInicio: 1, blocos: 1, blocoLabel: 'letra',
  andarQtd: 10, andarInicio: 1, unidadesPorAndar: 4,
  modoUnidade: 'andar', areasComuns: [], areasGlobais: [],
});

const [linearPayload, setLinearPayload] = useState<LinearPayload>({
  trechos: [{ nome: '', kmInicio: 0, kmFim: 5, intervaloKm: 0.5, elementoLabel: 'PV' }],
});

const [instalacaoPayload, setInstalacaoPayload] = useState<InstalacaoPayload>({
  areas: [{ nome: '', modulosQtde: 1, modulosNomes: [], modoModulo: 'qtde' }],
});
```

Adicionar mutations para cada estratégia (após `gerarCascataGenericaMutation`):
```tsx
const gerarCascataEdificacaoMutation = useMutation({
  mutationFn: () => obrasService.gerarCascata(obraCriada!.id, 'edificacao', edificacaoPayload),
  onSuccess: () => navigate(`/obras/${obraCriada!.id}`),
  onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao gerar locais'),
});

const gerarCascataLinearMutation = useMutation({
  mutationFn: () => obrasService.gerarCascata(obraCriada!.id, 'linear', linearPayload),
  onSuccess: () => navigate(`/obras/${obraCriada!.id}`),
  onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao gerar locais'),
});

const gerarCascataInstalacaoMutation = useMutation({
  mutationFn: () =>
    obrasService.gerarCascata(obraCriada!.id, 'instalacao', {
      areas: instalacaoPayload.areas.map((a) => ({
        nome: a.nome,
        modulos: a.modoModulo === 'qtde' ? a.modulosQtde : a.modulosNomes,
      })),
    }),
  onSuccess: () => navigate(`/obras/${obraCriada!.id}`),
  onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao gerar locais'),
});
```

- [ ] **Step 6: Desbloquear estratégias e renderizar forms na Etapa 3**

No seletor de estratégias, remover `emBreve: true` de todas:
```tsx
{ key: 'edificacao' as EstrategiaGeracao, label: 'Edificação', desc: 'Condomínio, Blocos, Andares e Unidades', emBreve: false },
{ key: 'linear' as EstrategiaGeracao,     label: 'Linear',     desc: 'Trechos com PVs (rodovias, redes)',     emBreve: false },
{ key: 'instalacao' as EstrategiaGeracao, label: 'Instalação', desc: 'Áreas com módulos (fábricas, ETEs)',    emBreve: false },
```

Após o bloco `{state.gerarLocais && estrategia === 'generica' && (...)}`, adicionar:
```tsx
{state.gerarLocais && estrategia === 'edificacao' && (
  <EdificacaoForm value={edificacaoPayload} onChange={setEdificacaoPayload} />
)}

{state.gerarLocais && estrategia === 'linear' && (
  <LinearForm value={linearPayload} onChange={setLinearPayload} />
)}

{state.gerarLocais && estrategia === 'instalacao' && (
  <InstalacaoForm value={instalacaoPayload} onChange={setInstalacaoPayload} />
)}
```

Substituir o `<BotoesWizard>` da Etapa 3 para incluir todas as estratégias:
```tsx
<BotoesWizard
  onVoltar={() => setEtapa(2)}
  onAvancar={
    !state.gerarLocais
      ? handleFinalizarSemLocais
      : estrategia === 'generica'
      ? () => gerarCascataGenericaMutation.mutate()
      : estrategia === 'edificacao'
      ? () => gerarCascataEdificacaoMutation.mutate()
      : estrategia === 'linear'
      ? () => gerarCascataLinearMutation.mutate()
      : estrategia === 'instalacao'
      ? () => gerarCascataInstalacaoMutation.mutate()
      : handleFinalizarSemLocais
  }
  carregando={
    gerarCascataGenericaMutation.isPending ||
    gerarCascataEdificacaoMutation.isPending ||
    gerarCascataLinearMutation.isPending ||
    gerarCascataInstalacaoMutation.isPending
  }
  podeAvancar={
    !state.gerarLocais ||
    (estrategia !== null &&
      (estrategia !== 'generica' ||
        multiNiveis.every((n) => n.prefixo.trim().length > 0 && n.qtde > 0)))
  }
  labelAvancar={state.gerarLocais ? 'Gerar Locais e Finalizar' : 'Finalizar Cadastro'}
/>
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

- [ ] **Step 8: Commit**

```bash
git add src/pages/obras/estrategias/ src/pages/obras/CadastroObraWizard.tsx
git commit -m "feat(obras): add Edificacao, Linear and Instalacao strategy forms in wizard"
```

---

## Self-Review

**1. Cobertura do spec:**
- G5 ✅ Task 1
- G3 ✅ Task 2
- G1 ✅ Task 3
- G4 ✅ Task 4 (combinada com G8)
- G8 ✅ Task 4 (combinada com G4)
- G7 ✅ Task 5
- G2 ✅ Task 6
- G6 ✅ Task 7

**2. Scan de placeholders:** Nenhum TBD/TODO/similar encontrado.

**3. Consistência de tipos:**
- `ObraDetalhe` de `obras.service.ts` usada corretamente em `EditarObraModal`
- `EstrategiaGeracao` existente em `obras.service.ts` usada no wizard sem redeclaração
- `obrasService.updateLocal` aceita `{ nome?: string, ordem?: number }` — ambos usados corretamente
- Interfaces `EdificacaoPayload`, `LinearPayload`, `InstalacaoPayload` declaradas nos form files e importadas no wizard
- `gerarCascata(obraId, estrategia, payload)` — assinatura já existente em `obras.service.ts`
