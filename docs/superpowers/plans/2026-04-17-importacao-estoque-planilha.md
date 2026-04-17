# Importação de Estoque via Planilha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir download de template `.xlsx` e upload para carga inicial de estoque — cria/atualiza itens no catálogo e soma saldo em um local escolhido pelo usuário.

**Architecture:** Dois endpoints novos em `EstoqueController` (GET template, POST importar). `EstoqueService` usa `xlsx` (já instalado) para gerar e parsear o arquivo. Frontend adiciona dois métodos no `almoxarifadoService` e um modal de 3 etapas em `EstoquePage`.

**Tech Stack:** NestJS · `xlsx@0.18.5` · `@nestjs/platform-express` (multer) · React · TanStack Query v5 · ExcelJS (frontend, apenas para compatibilidade de tipos — o download vem do backend)

---

## Arquivos

```
backend/src/almoxarifado/estoque/
  estoque.service.ts          [MODIFY — adicionar gerarTemplate() e importarPlanilha()]
  estoque.controller.ts       [MODIFY — adicionar 2 endpoints]

frontend-web/src/modules/almoxarifado/
  _service/almoxarifado.service.ts                        [MODIFY — 2 métodos novos]
  estoque/components/ImportarPlanilhaModal.tsx            [CREATE]
  estoque/pages/EstoquePage.tsx                           [MODIFY — botão + modal]
```

---

## Contexto que o implementador precisa saber

- Todos os DB ops usam `this.prisma.$queryRawUnsafe<T[]>(sql, ...params)` e `this.prisma.$executeRawUnsafe(sql, ...params)`. **Nunca** usar Prisma ORM direto.
- Auth: decorators `@TenantId()` (extrai tenantId do JWT), `@Roles(...)`, guards `JwtAuthGuard` e `RolesGuard` — já estão em todos os outros endpoints do mesmo controller.
- `req.user?.sub ?? req.user?.id` = usuarioId (padrão do projeto).
- Upload: `@nestjs/platform-express` já está instalado. Usar `FileInterceptor('file')` de `@nestjs/platform-express` com `@UploadedFile()`.
- Biblioteca `xlsx` no backend: `import * as XLSX from 'xlsx'`. Não instalar nada novo.
- Frontend file upload pattern existente em `importarOrcamento()`: `api.postForm(url, formData)`.
- Frontend download de blob: `api` é axios — usar `api.get(url, { responseType: 'blob' })`.
- Tabelas relevantes: `fvm_catalogo_materiais`, `fvm_categorias_materiais`, `alm_estoque_saldo`, `alm_movimentos`, `alm_locais`.

---

## Task 1: Backend — `gerarTemplate()` + endpoint GET

**Files:**
- Modify: `backend/src/almoxarifado/estoque/estoque.service.ts`
- Modify: `backend/src/almoxarifado/estoque/estoque.controller.ts`

- [ ] **Step 1: Adicionar método `gerarTemplate()` em `EstoqueService`**

Abrir `backend/src/almoxarifado/estoque/estoque.service.ts`. Adicionar import no topo:

```typescript
import * as XLSX from 'xlsx';
```

Adicionar método ao final da classe, antes do `}` de fechamento:

```typescript
// ── Importação via planilha ───────────────────────────────────────────────

gerarTemplate(): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Aba Importação ────────────────────────────────────────────────────
  const headers = [
    'Código', 'Nome do Material', 'Categoria',
    'Unidade', 'Quantidade', 'Estoque Mínimo', 'Observação',
  ];
  const exemplo = [
    'PAR-001', 'Parafuso 1/2" x 3/4"', 'Fixação',
    'un', 100, 20, 'Estoque inicial',
  ];
  const wsImport = XLSX.utils.aoa_to_sheet([headers, exemplo]);

  // Larguras de coluna
  wsImport['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 20 },
    { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 30 },
  ];

  // ── Aba Instruções ────────────────────────────────────────────────────
  const instrucoes = [
    ['Campo', 'Obrigatório', 'Descrição'],
    ['Código', 'Não', 'Código interno do material. Se preenchido, usado para localizar item existente no catálogo; se vazio, busca por Nome.'],
    ['Nome do Material', 'SIM', 'Nome completo do material. Obrigatório.'],
    ['Categoria', 'Não', 'Nome da categoria. Se não existir, será criada automaticamente.'],
    ['Unidade', 'SIM', 'Unidade de medida. Valores aceitos: un, kg, m, m², m³, L, cx, sc, gl, pc'],
    ['Quantidade', 'SIM', 'Quantidade a adicionar ao saldo. Número ≥ 0.'],
    ['Estoque Mínimo', 'Não', 'Ponto de reposição. Número ≥ 0. Se vazio, mantém valor atual (ou 0 para item novo).'],
    ['Observação', 'Não', 'Texto livre registrado no movimento gerado.'],
    [],
    ['Regras de conflito:'],
    ['• Se o material já existir no catálogo (por código ou nome): atualiza nome e unidade, SOMA a quantidade ao saldo existente.'],
    ['• Linhas com erro são puladas — as demais são processadas normalmente.'],
    ['• O local de destino é escolhido na tela antes do upload — não é um campo da planilha.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInstr['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 80 }];

  XLSX.utils.book_append_sheet(wb, wsImport, 'Importação');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
```

- [ ] **Step 2: Adicionar endpoint GET no `EstoqueController`**

Abrir `backend/src/almoxarifado/estoque/estoque.controller.ts`. Adicionar import:

```typescript
import { Res } from '@nestjs/common';
import type { Response } from 'express';
```

Adicionar na seção de imports já existente no topo: `Res` junto aos outros imports de `@nestjs/common`. Depois adicionar o endpoint logo após o `getDashboard`:

```typescript
// ── Importação via planilha ───────────────────────────────────────────────

@Get('estoque/importar/template')
@Roles('ADMIN_TENANT', 'ENGENHEIRO')
baixarTemplate(@Res() res: Response) {
  const buffer = this.estoque.gerarTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-estoque.xlsx"');
  res.send(buffer);
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "estoque" | head -20
```

Esperado: sem erros.

- [ ] **Step 4: Testar endpoint manualmente**

```bash
# No terminal, com o servidor rodando:
curl -s -o /tmp/modelo.xlsx \
  -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/v1/almoxarifado/estoque/importar/template
file /tmp/modelo.xlsx
```

Esperado: `Microsoft XLSX` ou `Zip archive data`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/almoxarifado/estoque/estoque.service.ts \
        backend/src/almoxarifado/estoque/estoque.controller.ts
git commit -m "feat(alm): GET /estoque/importar/template — gera xlsx pré-formatado"
```

---

## Task 2: Backend — `importarPlanilha()` + endpoint POST

**Files:**
- Modify: `backend/src/almoxarifado/estoque/estoque.service.ts`
- Modify: `backend/src/almoxarifado/estoque/estoque.controller.ts`

- [ ] **Step 1: Adicionar tipo `ImportacaoResultado` no topo de `estoque.service.ts`**

Logo após os imports existentes, antes da declaração `@Injectable()`:

```typescript
export interface ImportacaoResultado {
  processadas: number;
  erros: Array<{ linha: number; motivo: string }>;
  avisos: Array<{ linha: number; motivo: string }>;
}

const UNIDADES_VALIDAS = ['un', 'kg', 'm', 'm²', 'm³', 'L', 'cx', 'sc', 'gl', 'pc'];
```

- [ ] **Step 2: Adicionar método `importarPlanilha()` em `EstoqueService`**

Adicionar logo após `gerarTemplate()`:

```typescript
async importarPlanilha(
  tenantId: number,
  localId: number,
  usuarioId: number,
  fileBuffer: Buffer,
): Promise<ImportacaoResultado> {
  // 1. Validar que o local pertence ao tenant
  const locais = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM alm_locais WHERE id = $1 AND tenant_id = $2 AND ativo = true`,
    localId, tenantId,
  );
  if (locais.length === 0) {
    throw new BadRequestException('Local não encontrado ou inativo');
  }

  // 2. Parsear planilha
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const ws = wb.Sheets['Importação'];
  if (!ws) throw new BadRequestException('Aba "Importação" não encontrada no arquivo');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const resultado: ImportacaoResultado = { processadas: 0, erros: [], avisos: [] };

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2; // linha 1 = header, dados começam na 2
    const row = rows[i];

    const codigo     = String(row['Código'] ?? '').trim() || null;
    const nome       = String(row['Nome do Material'] ?? '').trim();
    const categoria  = String(row['Categoria'] ?? '').trim() || null;
    const unidade    = String(row['Unidade'] ?? '').trim();
    const qtdRaw     = row['Quantidade'];
    const minRaw     = row['Estoque Mínimo'];
    const obs        = String(row['Observação'] ?? '').trim() || null;

    // Validações obrigatórias
    if (!nome) {
      resultado.erros.push({ linha, motivo: 'Nome do Material é obrigatório' });
      continue;
    }
    if (!unidade || !UNIDADES_VALIDAS.includes(unidade)) {
      resultado.erros.push({ linha, motivo: `Unidade inválida: "${unidade}". Use: ${UNIDADES_VALIDAS.join(', ')}` });
      continue;
    }
    const quantidade = Number(qtdRaw);
    if (isNaN(quantidade) || quantidade < 0) {
      resultado.erros.push({ linha, motivo: `Quantidade inválida: "${qtdRaw}"` });
      continue;
    }
    const estoqueMin = minRaw !== '' && minRaw !== null ? Number(minRaw) : null;
    if (estoqueMin !== null && (isNaN(estoqueMin) || estoqueMin < 0)) {
      resultado.erros.push({ linha, motivo: `Estoque Mínimo inválido: "${minRaw}"` });
      continue;
    }

    try {
      // 3. Resolver categoria (se informada)
      let categoriaId: number | null = null;
      if (categoria) {
        const catRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM fvm_categorias_materiais WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2)`,
          tenantId, categoria,
        );
        if (catRows.length > 0) {
          categoriaId = catRows[0].id;
        } else {
          const newCat = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
            `INSERT INTO fvm_categorias_materiais (tenant_id, nome, ativo, created_at, updated_at)
             VALUES ($1, $2, true, NOW(), NOW()) RETURNING id`,
            tenantId, categoria,
          );
          categoriaId = newCat[0].id;
          resultado.avisos.push({ linha, motivo: `Categoria "${categoria}" criada automaticamente` });
        }
      }

      // 4. Localizar ou criar item no catálogo
      let catalogoId: number;
      let saldoAtual = 0;

      const byCodigo = codigo
        ? await this.prisma.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM fvm_catalogo_materiais WHERE tenant_id = $1 AND codigo = $2 AND deleted_at IS NULL`,
            tenantId, codigo,
          )
        : [];

      const byNome = byCodigo.length === 0
        ? await this.prisma.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM fvm_catalogo_materiais WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2) AND deleted_at IS NULL`,
            tenantId, nome,
          )
        : [];

      const existing = byCodigo[0] ?? byNome[0] ?? null;

      if (existing) {
        catalogoId = existing.id;
        // Atualizar campos do catálogo
        await this.prisma.$executeRawUnsafe(
          `UPDATE fvm_catalogo_materiais
           SET nome = $1, unidade = $2,
               codigo = COALESCE($3, codigo),
               categoria_id = COALESCE($4::int, categoria_id),
               updated_at = NOW()
           WHERE id = $5`,
          nome, unidade, codigo, categoriaId, catalogoId,
        );
      } else {
        // Criar novo item no catálogo
        const newItem = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
          `INSERT INTO fvm_catalogo_materiais
             (tenant_id, nome, codigo, unidade, categoria_id,
              foto_modo, exige_certificado, exige_nota_fiscal, exige_laudo_ensaio,
              prazo_quarentena_dias, ordem, ativo, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,'nenhuma',false,true,false,0,0,true,NOW(),NOW())
           RETURNING id`,
          tenantId, nome, codigo, unidade, categoriaId,
        );
        catalogoId = newItem[0].id;
      }

      // 5. Buscar saldo atual para calcular saldo_anterior
      const saldoRows = await this.prisma.$queryRawUnsafe<{ quantidade: number }[]>(
        `SELECT quantidade FROM alm_estoque_saldo WHERE tenant_id=$1 AND local_id=$2 AND catalogo_id=$3`,
        tenantId, localId, catalogoId,
      );
      saldoAtual = saldoRows.length > 0 ? Number(saldoRows[0].quantidade) : 0;

      const saldoPosterior = saldoAtual + quantidade;
      const novoMin = estoqueMin !== null ? estoqueMin : (saldoRows.length > 0 ? undefined : 0);

      // 6. Upsert saldo
      if (novoMin !== undefined) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, quantidade, estoque_min, unidade, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id)
           DO UPDATE SET quantidade = $4, estoque_min = $5, unidade = $6, updated_at = NOW()`,
          tenantId, localId, catalogoId, saldoPosterior, novoMin, unidade,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, quantidade, estoque_min, unidade, updated_at)
           VALUES ($1,$2,$3,$4,0,$5,NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id)
           DO UPDATE SET quantidade = alm_estoque_saldo.quantidade + $4, unidade = $5, updated_at = NOW()`,
          tenantId, localId, catalogoId, quantidade, unidade,
        );
      }

      // 7. Registrar movimento
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO alm_movimentos
           (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
            saldo_anterior, saldo_posterior, referencia_tipo, observacao, criado_por, created_at)
         VALUES ($1,$2,$3,'entrada',$4,$5,$6,$7,'manual',$8,$9,NOW())`,
        tenantId, catalogoId, localId, quantidade, unidade,
        saldoAtual, saldoPosterior,
        obs ?? 'Importação via planilha',
        usuarioId,
      );

      resultado.processadas++;
    } catch (err: any) {
      resultado.erros.push({ linha, motivo: err?.message ?? 'Erro interno' });
    }
  }

  this.logger.log(JSON.stringify({
    action: 'alm.estoque.importar',
    tenantId, localId, usuarioId,
    processadas: resultado.processadas,
    erros: resultado.erros.length,
  }));

  return resultado;
}
```

- [ ] **Step 3: Adicionar endpoint POST no `EstoqueController`**

Adicionar imports adicionais no topo do controller:

```typescript
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
```

Adicionar endpoint após `baixarTemplate`:

```typescript
@Post('estoque/importar')
@Roles('ADMIN_TENANT', 'ENGENHEIRO')
@HttpCode(HttpStatus.OK)
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}))
async importarPlanilha(
  @TenantId() tenantId: number,
  @Req() req: any,
  @UploadedFile() file: Express.Multer.File,
  @Body('local_id') localIdStr: string,
) {
  if (!file) throw new BadRequestException('Arquivo não enviado');
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx') throw new BadRequestException('Apenas arquivos .xlsx são aceitos');

  const localId = Number(localIdStr);
  if (!localId || isNaN(localId)) throw new BadRequestException('local_id inválido');

  const usuarioId: number = req.user?.sub ?? req.user?.id;
  return this.estoque.importarPlanilha(tenantId, localId, usuarioId, file.buffer);
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "estoque|error" | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/src/almoxarifado/estoque/estoque.service.ts \
        backend/src/almoxarifado/estoque/estoque.controller.ts
git commit -m "feat(alm): POST /estoque/importar — importação em lote via planilha xlsx"
```

---

## Task 3: Frontend — métodos no `almoxarifadoService`

**Files:**
- Modify: `frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts`

- [ ] **Step 1: Adicionar tipo `ImportacaoResultado`**

Abrir o arquivo. Após os tipos existentes no topo (após `AlmSugestaoIa`), adicionar:

```typescript
export interface ImportacaoResultado {
  processadas: number;
  erros: Array<{ linha: number; motivo: string }>;
  avisos: Array<{ linha: number; motivo: string }>;
}
```

- [ ] **Step 2: Adicionar os dois métodos no objeto `almoxarifadoService`**

Após `reanalisarInsights`, adicionar:

```typescript
  // Importação de estoque via planilha
  downloadTemplateEstoque: async (): Promise<void> => {
    const response = await (api as any).axiosInstance.get(
      `${BASE}/estoque/importar/template`,
      { responseType: 'blob' },
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-estoque.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  importarEstoque: (localId: number, file: File): Promise<ImportacaoResultado> => {
    const form = new FormData();
    form.append('file', file);
    form.append('local_id', String(localId));
    return api.postForm(`${BASE}/estoque/importar`, form).then((r: any) => r.data?.data ?? r.data);
  },
```

**Nota:** O `api` é uma instância axios configurada. Se `api.axiosInstance` não existir, usar o padrão alternativo:

```typescript
  downloadTemplateEstoque: async (): Promise<void> => {
    // Importar axios diretamente para requests com responseType blob
    const { default: axios } = await import('axios');
    const token = localStorage.getItem('eldox_token') ?? sessionStorage.getItem('eldox_token') ?? '';
    const response = await axios.get(
      `/api/v1/${BASE}/estoque/importar/template`,
      {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-estoque.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
```

Verificar como o `api` é instanciado em `frontend-web/src/services/api.ts` para saber qual padrão usar.

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | grep "almoxarifado.service" | head -10
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts
git commit -m "feat(alm): service methods downloadTemplateEstoque e importarEstoque"
```

---

## Task 4: Frontend — `ImportarPlanilhaModal` component

**Files:**
- Create: `frontend-web/src/modules/almoxarifado/estoque/components/ImportarPlanilhaModal.tsx`

- [ ] **Step 1: Criar o componente**

Criar o arquivo com o seguinte conteúdo:

```tsx
// frontend-web/src/modules/almoxarifado/estoque/components/ImportarPlanilhaModal.tsx
import { useState, useRef } from 'react'
import { Download, Upload, X, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react'
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

          {/* Etapa 1 — Configurar */}
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
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | grep "ImportarPlanilhaModal" | head -10
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/almoxarifado/estoque/components/ImportarPlanilhaModal.tsx
git commit -m "feat(alm): ImportarPlanilhaModal — 3 etapas: configurar, upload, resultado"
```

---

## Task 5: Frontend — Botão + wiring em `EstoquePage`

**Files:**
- Modify: `frontend-web/src/modules/almoxarifado/estoque/pages/EstoquePage.tsx`

- [ ] **Step 1: Adicionar import e estado**

No topo do arquivo, adicionar ao import existente de lucide-react:

```typescript
import { AlertOctagon, AlertTriangle, CheckCircle, Plus, X, Search, Upload } from 'lucide-react'
```

Adicionar import do modal (logo após os outros imports):

```typescript
import { ImportarPlanilhaModal } from '../components/ImportarPlanilhaModal'
```

No corpo da função `EstoquePage`, após o estado `movimentoOpen`, adicionar:

```typescript
const [importarOpen, setImportarOpen] = useState(false)
```

- [ ] **Step 2: Adicionar botão "Importar Planilha" na toolbar**

Localizar o bloco `<div className="flex gap-2">` que contém os botões "Transferência" e "Movimento Manual". Adicionar o botão de importação **entre** os dois existentes:

```tsx
<button
  onClick={() => setImportarOpen(true)}
  className={cn(
    'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px] font-medium',
    'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
    'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
  )}
>
  <Upload size={13} /> Importar Planilha
</button>
```

- [ ] **Step 3: Renderizar o modal**

No final do JSX retornado por `EstoquePage`, antes do último `</div>` de fechamento, adicionar:

```tsx
{importarOpen && (
  <ImportarPlanilhaModal
    onClose={() => setImportarOpen(false)}
    onSuccess={() => {
      setImportarOpen(false)
      // React Query vai revalidar automaticamente via invalidateQueries no modal
    }}
  />
)}
```

**Nota:** O `onSuccess` do modal já chama `onSuccess` antes de fechar (no `handleImportar`). A query `['alm-estoque']` precisa ser invalidada. Verificar se `useRegistrarMovimento` já invalida a query correta — se não, no `handleImportar` do modal adicionar `queryClient.invalidateQueries({ queryKey: ['alm-estoque'] })` usando `useQueryClient`.

Se necessário, atualizar o `handleImportar` no modal para invalidar queries:

```tsx
// No ImportarPlanilhaModal, adicionar no topo:
import { useQueryClient } from '@tanstack/react-query'

// Na função:
const qc = useQueryClient()

// No try do handleImportar, após setResultado:
qc.invalidateQueries({ queryKey: ['alm-estoque'] })
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | grep -E "EstoquePage|ImportarPlanilha" | head -10
```

Esperado: sem erros.

- [ ] **Step 5: Commit e push**

```bash
git add frontend-web/src/modules/almoxarifado/estoque/pages/EstoquePage.tsx \
        frontend-web/src/modules/almoxarifado/estoque/components/ImportarPlanilhaModal.tsx
git commit -m "feat(alm): botão Importar Planilha na EstoquePage"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Template com 2 abas (Importação + Instruções) — Task 1
- ✅ GET /estoque/importar/template — Task 1
- ✅ POST /estoque/importar com local_id + file — Task 2
- ✅ Conflito: atualiza catálogo + soma saldo — Task 2
- ✅ Categoria criada automaticamente com aviso — Task 2
- ✅ Erros por linha sem cancelar restante — Task 2
- ✅ Movimento 'entrada' registrado por linha — Task 2
- ✅ downloadTemplateEstoque + importarEstoque no service — Task 3
- ✅ Modal 3 etapas (configurar/upload/resultado) — Task 4
- ✅ Botão "Importar Planilha" na EstoquePage — Task 5
- ✅ Invalidação de query após importação — Task 5

**Tipo consistency:**
- `ImportacaoResultado` definido em Task 2 (backend) e Task 3 (frontend) com mesma estrutura
- `almoxarifadoService.importarEstoque(localId, file)` chamado no modal corretamente
- `almoxarifadoService.downloadTemplateEstoque()` sem parâmetros — correto
