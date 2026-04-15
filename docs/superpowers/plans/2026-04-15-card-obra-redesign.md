# Card de Obra Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar foto de capa real, caixa de counters (inspeções/fotos/locais) e barra de prazo correta ao card de obra na grade, sem quebrar wizard, kanban ou semáforo PBQP-H.

**Architecture:** Migration aditiva adiciona `fotoCapa` ao model `Obra`. Backend expõe novo endpoint de upload (sharp → WebP → MinIO) e enriches `GET /obras` com contagens via raw SQL nas tabelas `fvs_fichas` e `fvs_evidencias`. Frontend redesenha `ObraCard` e adiciona upload nos dois pontos de entrada (wizard e modal de edição).

**Tech Stack:** NestJS + Prisma + PostgreSQL + MinIO (sharp para resize) · React + TypeScript + TailwindCSS + @tanstack/react-query

**Spec:** `docs/superpowers/specs/2026-04-15-card-obra-redesign.md`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `backend/prisma/schema.prisma` | Modificar — adicionar `fotoCapa String?` ao model `Obra` |
| `backend/prisma/migrations/…` | Criar — migration aditiva `add_foto_capa_to_obras` |
| `backend/src/obras/obras.service.ts` | Modificar — counters em `findAll`, novo método `uploadFotoCapa` |
| `backend/src/obras/obras.controller.ts` | Modificar — novo endpoint `POST /obras/:id/foto-capa` |
| `frontend/src/services/obras.service.ts` | Modificar — novos campos em `Obra`, novo método `uploadFotoCapa` |
| `frontend/src/pages/obras/ObrasListPage.tsx` | Modificar — redesenho de `ObraCard` |
| `frontend/src/pages/obras/CadastroObraWizard.tsx` | Modificar — upload opcional na etapa Localização |
| `frontend/src/pages/obras/EditarObraModal.tsx` | Modificar — campo de upload de foto |

---

## Task 1 — Migration: campo fotoCapa

**Files:**
- Modify: `backend/prisma/schema.prisma` (model Obra, linha ~145)

- [ ] **Step 1: Adicionar campo fotoCapa ao model Obra**

No `schema.prisma`, dentro de `model Obra`, após a linha `longitude Decimal? ...`, adicionar:

```prisma
// Foto de capa
fotoCapa  String?   // MinIO key (nunca expor ao frontend diretamente)
```

O model fica assim na seção de campos:
```prisma
model Obra {
  id            Int           @id @default(autoincrement())
  tenantId      Int
  // ... campos existentes ...
  latitude      Decimal?  @db.Decimal(10, 7)
  longitude     Decimal?  @db.Decimal(10, 7)

  // Foto de capa
  fotoCapa      String?   // MinIO key

  // Dados extras ...
  dadosExtras Json?
```

- [ ] **Step 2: Rodar a migration**

```bash
cd backend
npx prisma migrate dev --name add_foto_capa_to_obras
```

Saída esperada: `✔ Generated Prisma Client` sem erros.

- [ ] **Step 3: Verificar que o campo existe no banco**

```bash
npx prisma studio
```

Abrir tabela `Obra` e confirmar coluna `fotoCapa` nullable presente.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add fotoCapa field to Obra (migration)"
```

---

## Task 2 — Backend: counters em findAll

**Files:**
- Modify: `backend/src/obras/obras.service.ts`

**Contexto:** `fvs_fichas` (inspeções) é tabela raw SQL com coluna `obra_id`. `fvs_evidencias` (fotos) liga a `fvs_registros` → `fvs_fichas` → `obra_id`. Prisma não tem models para essas tabelas, usar `$queryRaw`.

- [ ] **Step 1: Adicionar helper de contagens no service**

No `obras.service.ts`, antes do método `findAll`, adicionar método privado:

```typescript
private async contarInspecoesEFotos(
  tenantId: number,
  obraIds: number[],
): Promise<Map<number, { totalInspecoes: number; totalFotos: number }>> {
  if (obraIds.length === 0) return new Map();

  const rows = await this.prisma.$queryRaw<
    { obra_id: number; total_inspecoes: bigint; total_fotos: bigint }[]
  >`
    SELECT
      f.obra_id,
      COUNT(DISTINCT f.id)::bigint AS total_inspecoes,
      COUNT(e.id)::bigint          AS total_fotos
    FROM fvs_fichas f
    LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
    LEFT JOIN fvs_evidencias e ON e.registro_id = r.id AND e.tenant_id = f.tenant_id
    WHERE f.tenant_id = ${tenantId}
      AND f.obra_id = ANY(${obraIds}::int[])
      AND f.deleted_at IS NULL
    GROUP BY f.obra_id
  `;

  return new Map(
    rows.map((r) => [
      Number(r.obra_id),
      {
        totalInspecoes: Number(r.total_inspecoes),
        totalFotos:     Number(r.total_fotos),
      },
    ]),
  );
}
```

- [ ] **Step 2: Chamar o helper no findAll e incluir fotoCapaUrl**

Substituir o método `findAll` existente. A parte de mapeamento final (`items.map`) passa de:

```typescript
return {
  items: items.map((o) => ({
    ...o,
    totalLocais: o._count.locais,
    _count: undefined,
  })),
```

Para:

```typescript
const obraIds = items.map((o) => o.id);
const contagens = await this.contarInspecoesEFotos(tenantId, obraIds);

return {
  items: items.map((o) => {
    const c = contagens.get(o.id) ?? { totalInspecoes: 0, totalFotos: 0 };
    return {
      ...o,
      totalLocais:    o._count.locais,
      totalInspecoes: c.totalInspecoes,
      totalFotos:     c.totalFotos,
      fotoCapaUrl:    o.fotoCapa ?? null, // Task 3 substituirá por presigned URL
      _count: undefined,
    };
  }),
```

- [ ] **Step 3: Build para verificar tipos**

```bash
cd backend
npm run build
```

Saída esperada: sem erros TypeScript.

- [ ] **Step 4: Commit**

```bash
git add backend/src/obras/obras.service.ts
git commit -m "feat: add totalInspecoes, totalFotos counters to GET /obras"
```

---

## Task 3 — Backend: endpoint de upload de foto de capa

**Files:**
- Modify: `backend/src/obras/obras.service.ts`
- Modify: `backend/src/obras/obras.controller.ts`

**Contexto:** `MinioService` existe em `src/ged/storage/minio.service.ts` e já é usado pelo GED. Precisamos injetá-lo no módulo de obras e usar `sharp` para resize.

- [ ] **Step 1: Instalar sharp**

```bash
cd backend
npm install sharp
npm install --save-dev @types/sharp
```

- [ ] **Step 2: Exportar MinioService do GedModule**

Abrir `backend/src/ged/ged.module.ts`. Adicionar `MinioService` em `exports` se não estiver:

```typescript
@Module({
  // ...
  providers: [..., MinioService],
  exports: [..., MinioService],   // ← garantir que está aqui
})
export class GedModule {}
```

- [ ] **Step 3: Importar GedModule no ObrasModule**

Abrir `backend/src/obras/obras.module.ts`. Adicionar `GedModule` em `imports`:

```typescript
import { GedModule } from '../ged/ged.module';

@Module({
  imports: [..., GedModule],   // ← adicionar
  // ...
})
export class ObrasModule {}
```

- [ ] **Step 4: Adicionar uploadFotoCapa ao service**

No `obras.service.ts`, adicionar import de `MinioService` e `sharp` no topo:

```typescript
import { MinioService } from '../ged/storage/minio.service';
import * as sharp from 'sharp';
```

Adicionar `MinioService` ao constructor:

```typescript
constructor(
  private prisma: PrismaService,
  private minio: MinioService,
  private genericaStrategy: GenericaStrategy,
  // ... restante
) {}
```

Adicionar método no service:

```typescript
async uploadFotoCapa(
  tenantId: number,
  obraId: number,
  file: Express.Multer.File,
): Promise<{ fotoCapaUrl: string }> {
  const obra = await this.findOne(tenantId, obraId);

  // Validar formato
  const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!formatosPermitidos.includes(file.mimetype)) {
    throw new BadRequestException(
      'Formato inválido. Use JPEG, PNG, WebP ou HEIC.',
    );
  }

  // Processar com sharp: redimensionar + converter para WebP
  const buffer = await sharp(file.buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Deletar foto antiga do MinIO se existir
  if (obra.fotoCapa) {
    try {
      await this.minio['client'].removeObject(
        this.minio['bucket'],
        obra.fotoCapa,
      );
    } catch {
      // Ignorar erro de deleção — arquivo pode já não existir
    }
  }

  // Upload para MinIO
  const key = `${tenantId}/obras/${obraId}/capa/${Date.now()}.webp`;
  await this.minio.uploadFile(buffer, key, 'image/webp');

  // Salvar key no banco
  await this.prisma.obra.update({
    where: { id: obraId },
    data: { fotoCapa: key },
  });

  // Gerar presigned URL (1h de validade)
  const url: string = await this.minio['client'].presignedGetObject(
    this.minio['bucket'],
    key,
    3600,
  );

  return { fotoCapaUrl: url };
}
```

- [ ] **Step 5: Adicionar endpoint no controller**

No `obras.controller.ts`, adicionar imports de multer:

```typescript
import {
  UseInterceptors,
  UploadedFile,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
```

Adicionar endpoint após o `@Put('obras/:id')`:

```typescript
@Post('obras/:id/foto-capa')
@Roles('TECNICO' as any, 'ENGENHEIRO' as any, 'ADMIN_TENANT' as any, 'SUPER_ADMIN' as any)
@HttpCode(HttpStatus.OK)
@UseInterceptors(
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }),
)
uploadFotoCapa(
  @TenantId() tenantId: number,
  @Param('id', ParseIntPipe) obraId: number,
  @UploadedFile() file: Express.Multer.File,
) {
  if (!file) throw new BadRequestException('Arquivo não enviado');
  return this.obrasService.uploadFotoCapa(tenantId, obraId, file);
}
```

- [ ] **Step 6: Atualizar fotoCapaUrl em findAll para usar presigned URL**

No `obras.service.ts`, no método `findAll`, atualizar a linha `fotoCapaUrl` para gerar URL real quando a key existe. Substituir:

```typescript
fotoCapaUrl: o.fotoCapa ?? null,
```

Por uma etapa em dois tempos — primeiro coletar keys, depois gerar URLs em paralelo:

```typescript
// Após `const contagens = ...`, antes do `return`:
const presignedUrls = new Map<number, string>();
await Promise.all(
  items
    .filter((o) => o.fotoCapa)
    .map(async (o) => {
      const url: string = await this.minio['client'].presignedGetObject(
        this.minio['bucket'],
        o.fotoCapa!,
        3600,
      );
      presignedUrls.set(o.id, url);
    }),
);
```

E no map final:
```typescript
fotoCapaUrl: presignedUrls.get(o.id) ?? null,
```

- [ ] **Step 7: Build**

```bash
cd backend
npm run build
```

Saída esperada: zero erros.

- [ ] **Step 8: Commit**

```bash
git add backend/src/obras/ backend/src/ged/ged.module.ts
git commit -m "feat: POST /obras/:id/foto-capa — upload, sharp resize, MinIO storage"
```

---

## Task 4 — Frontend: tipos e método de upload

**Files:**
- Modify: `frontend/src/services/obras.service.ts`

- [ ] **Step 1: Adicionar novos campos à interface Obra**

Na interface `Obra`, adicionar após `totalLocais`:

```typescript
export interface Obra {
  id: number;
  nome: string;
  codigo: string;
  modoQualidade: 'SIMPLES' | 'PBQPH';
  status: 'PLANEJAMENTO' | 'EM_EXECUCAO' | 'PARALISADA' | 'CONCLUIDA' | 'ENTREGUE';
  cidade?: string;
  estado?: string;
  dataInicioPrevista?: string;
  dataFimPrevista?: string;
  totalLocais: number;
  totalInspecoes: number;   // ← novo
  totalFotos: number;       // ← novo
  fotoCapaUrl?: string | null; // ← novo (presigned URL ou null)
  criadoEm: string;
  obraTipo: { id: number; nome: string; slug: string };
}
```

- [ ] **Step 2: Adicionar método uploadFotoCapa ao obrasService**

No objeto `obrasService`, adicionar após o método `remove`:

```typescript
uploadFotoCapa: async (obraId: number, file: File): Promise<{ fotoCapaUrl: string }> => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/api/v1/obras/${obraId}/foto-capa`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
},
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/obras.service.ts
git commit -m "feat: add totalInspecoes, totalFotos, fotoCapaUrl, uploadFotoCapa to frontend obras service"
```

---

## Task 5 — Frontend: redesenho do ObraCard

**Files:**
- Modify: `frontend/src/pages/obras/ObrasListPage.tsx`

Esta task redesenha apenas a função `ObraCard`. O restante da página (kanban, lista, paginação) não muda.

- [ ] **Step 1: Adicionar array CARD_GRADIENTS permanente (baseado em obra.id)**

O array já existe no arquivo. Mudar o cálculo no `ObraCard` de `CARD_GRADIENTS[index % CARD_GRADIENTS.length]` para `CARD_GRADIENTS[obra.id % CARD_GRADIENTS.length]`.

Localizar a linha:
```typescript
const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
```
Substituir por:
```typescript
const gradient = CARD_GRADIENTS[obra.id % CARD_GRADIENTS.length];
```

Remover o parâmetro `index` da assinatura do `ObraCard` e do seu uso em `obras.map(...)`.

Antes:
```typescript
function ObraCard({ obra, index, onVer, onRemover }: {
  obra: Obra; index: number; onVer: () => void; onRemover: () => void;
})
```
Depois:
```typescript
function ObraCard({ obra, onVer, onRemover }: {
  obra: Obra; onVer: () => void; onRemover: () => void;
})
```

No `.map` da listagem, remover o `, i` e o `index={i}`:
```typescript
{obras.map((obra) => (
  <ObraCard
    key={obra.id}
    obra={obra}
    onVer={() => navigate(`/obras/${obra.id}`)}
    onRemover={() => setConfirmRemover(obra.id)}
  />
))}
```

- [ ] **Step 2: Adicionar helper de cálculo de prazo**

Antes da função `ObraCard`, adicionar:

```typescript
function calcPrazo(dataInicio?: string, dataFim?: string): {
  show: boolean;
  pct: number;
  cor: string;
  texto: string;
} {
  if (!dataInicio || !dataFim) return { show: false, pct: 0, cor: '', texto: '' };

  const hoje = Date.now();
  const inicio = new Date(dataInicio).getTime();
  const fim = new Date(dataFim).getTime();
  const total = fim - inicio;

  if (total <= 0) return { show: false, pct: 0, cor: '', texto: '' };

  const pct = ((hoje - inicio) / total) * 100;
  const diasRestantes = Math.ceil((fim - hoje) / 86_400_000);

  if (pct < 0) return { show: true, pct: 0, cor: 'var(--accent)', texto: 'Não iniciada' };

  const cor =
    pct >= 100 ? '#f85149' :
    pct >= 80  ? '#fbbf24' :
                 'var(--accent)';

  const texto =
    diasRestantes <= 0
      ? 'Prazo vencido'
      : `${diasRestantes}d restantes`;

  return { show: true, pct: Math.min(pct, 100), cor, texto };
}
```

- [ ] **Step 3: Substituir o corpo do ObraCard**

Substituir o conteúdo completo da função `ObraCard` por:

```typescript
function ObraCard({ obra, onVer, onRemover }: {
  obra: Obra; onVer: () => void; onRemover: () => void;
}) {
  const gradient = CARD_GRADIENTS[obra.id % CARD_GRADIENTS.length];
  const prazo = calcPrazo(obra.dataInicioPrevista, obra.dataFimPrevista);

  const [imgError, setImgError] = useState(false);
  const usarFoto = !!obra.fotoCapaUrl && !imgError;

  const badgeCls: Record<string, string> = {
    EM_EXECUCAO:  'bg-green-500/20 text-green-400 border border-green-500/40',
    PARALISADA:   'bg-red-500/20 text-red-400 border border-red-500/40',
    CONCLUIDA:    'bg-blue-400/20 text-blue-300 border border-blue-400/40',
    ENTREGUE:     'bg-sky-400/20 text-sky-300 border border-sky-400/40',
    PLANEJAMENTO: 'bg-gray-500/20 text-gray-300 border border-gray-500/40',
  };

  return (
    <div
      className="rounded-xl border border-[var(--border-dim)] overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
      style={{ background: 'var(--bg-raised)' }}
      onClick={onVer}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.3)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-dim)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Capa */}
      <div className="relative h-[130px] overflow-hidden" style={{ background: gradient }}>
        {usarFoto ? (
          <img
            src={obra.fotoCapaUrl!}
            alt={obra.nome}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/10">
            <Building size={56} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.1) 0%, rgba(0,0,0,.55) 100%)' }} />
        <span className={cn('absolute top-2.5 left-2.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', badgeCls[obra.status] ?? badgeCls.PLANEJAMENTO)}>
          {STATUS_LABEL[obra.status]}
        </span>
        {obra.modoQualidade === 'PBQPH' && (
          <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40">
            PBQP-H
          </span>
        )}
        <span className="absolute bottom-2 right-2.5 text-[10px] font-mono text-white/50">
          {obra.codigo}
        </span>
      </div>

      {/* Corpo */}
      <div className="p-3 pb-3.5">
        <div className="font-semibold text-[13.5px] text-[var(--text-high)] leading-snug mb-1 line-clamp-2">
          {obra.nome}
        </div>

        {(obra.cidade || obra.estado) && (
          <div className="flex items-center gap-1 text-[11.5px] text-[var(--text-faint)] mb-2.5">
            <MapPin size={10} className="shrink-0" />
            {[obra.cidade, obra.estado].filter(Boolean).join(' / ')}
          </div>
        )}

        {/* Counters */}
        <div className="grid grid-cols-3 gap-1 mb-2.5 p-2 rounded-lg bg-black/20">
          {[
            { num: obra.totalInspecoes, lbl: 'Inspeções' },
            { num: obra.totalFotos,     lbl: 'Fotos' },
            { num: obra.totalLocais,    lbl: 'Locais' },
          ].map(({ num, lbl }) => (
            <div key={lbl} className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[var(--text-high)] leading-none">{num.toLocaleString('pt-BR')}</span>
              <span className="text-[9.5px] uppercase tracking-wide text-[var(--text-faint)]">{lbl}</span>
            </div>
          ))}
        </div>

        {/* Barra de prazo */}
        {prazo.show && (
          <div className="mb-2.5">
            <div className="flex justify-between text-[11px] text-[var(--text-faint)] mb-1">
              <span className="text-[var(--text-high)] font-medium">
                {obra.dataInicioPrevista
                  ? `Início ${new Date(obra.dataInicioPrevista).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
                  : ''}
              </span>
              <span style={{ color: prazo.cor }}>{prazo.texto}</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${prazo.pct}%`, background: prazo.cor }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)] pt-2.5 mt-1 border-t border-[var(--border-dim)]">
          <span className="truncate">{obra.obraTipo.nome}</span>
          {obra.modoQualidade === 'PBQPH' && (
            <SemaforoBadge obraId={obra.id} />
          )}
          <button
            onClick={e => { e.stopPropagation(); onRemover(); }}
            className="ml-auto text-base text-[var(--text-faint)] opacity-30 hover:opacity-100 hover:text-red-500 transition-all px-1"
            title="Remover"
          >×</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar que `useState` está importado**

No topo do arquivo, `useState` já está importado. Confirmar:
```typescript
import { useState } from 'react';
```

- [ ] **Step 5: Testar no browser**

```bash
cd frontend
npm run dev
```

Abrir `/obras` e verificar:
- Cards mostram gradient rotativo (sem foto)
- Counters aparecem (provavelmente zeros se o backend ainda não retorna os dados)
- Barra de prazo calculada corretamente
- Toggle grade/lista/kanban continua funcionando

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/obras/ObrasListPage.tsx
git commit -m "feat: redesign ObraCard — counters, real prazo bar, foto capa with fallback"
```

---

## Task 6 — Frontend: upload de foto no Wizard

**Files:**
- Modify: `frontend/src/pages/obras/CadastroObraWizard.tsx`

Upload é **opcional** na etapa 1 (Localização), realizado *após* a criação da obra (etapa já cria a obra no `handleCriarObra`). A foto é enviada quando o usuário a selecionar e a obra já tiver sido criada.

- [ ] **Step 1: Adicionar estado de foto ao wizard**

No `CadastroObraWizard`, após `const [erro, setErro] = useState('')`, adicionar:

```typescript
const [fotoCapa, setFotoCapa] = useState<File | null>(null);
const [fotoPreview, setFotoPreview] = useState<string | null>(null);
```

- [ ] **Step 2: Adicionar mutation de upload**

Após `criarObraMutation`, adicionar:

```typescript
const uploadFotoMutation = useMutation({
  mutationFn: (obraId: number) => obrasService.uploadFotoCapa(obraId, fotoCapa!),
  onError: () => {
    // Erro não bloqueia o fluxo — foto pode ser adicionada depois
    setErro('Foto não pôde ser enviada. Continue sem ela ou tente no modal de edição.');
  },
});
```

- [ ] **Step 3: Encadear upload após criação da obra**

Modificar o `onSuccess` do `criarObraMutation`:

```typescript
onSuccess: async (res) => {
  setObraCriada(res.obra);
  if (fotoCapa) {
    await uploadFotoMutation.mutateAsync(res.obra.id).catch(() => {});
  }
  setEtapa(2);
},
```

- [ ] **Step 4: Adicionar campo de upload na etapa Localização (etapa 1)**

No JSX da etapa 1, antes de `<BotoesWizard ...>`, adicionar:

```tsx
<Campo label="Foto de capa (opcional)">
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {fotoPreview ? (
      <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <img src={fotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <button
          type="button"
          onClick={() => { setFotoCapa(null); setFotoPreview(null); }}
          style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
            borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      </div>
    ) : (
      <label
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '80px', border: '1px dashed var(--bg-border)',
          borderRadius: 'var(--radius-md)', cursor: 'pointer',
          color: 'var(--text-40)', fontSize: '13px', gap: '8px',
          background: 'var(--bg-surface)',
        }}
      >
        📷 Clique para adicionar foto
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
              setErro('Foto muito grande. Máximo 10MB.');
              return;
            }
            setFotoCapa(file);
            setFotoPreview(URL.createObjectURL(file));
          }}
        />
      </label>
    )}
    <p style={{ fontSize: '11px', color: 'var(--text-40)' }}>
      JPEG, PNG, WebP ou HEIC · máx 10MB · será convertida para WebP no servidor
    </p>
  </div>
</Campo>
```

- [ ] **Step 5: Testar no browser**

Criar nova obra, selecionar foto na etapa Localização, prosseguir e confirmar que a obra é criada sem travar mesmo se o upload falhar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/obras/CadastroObraWizard.tsx
git commit -m "feat: optional foto capa upload in obra wizard step 1"
```

---

## Task 7 — Frontend: upload de foto no modal de edição

**Files:**
- Modify: `frontend/src/pages/obras/EditarObraModal.tsx`

- [ ] **Step 1: Adicionar estado de foto ao modal**

No `EditarObraModal`, após `const queryClient = useQueryClient()`, adicionar:

```typescript
const [fotoCapa, setFotoCapa] = useState<File | null>(null);
const [fotoPreview, setFotoPreview] = useState<string | null>(obra.fotoCapaUrl ?? null);
const [uploadando, setUploadando] = useState(false);
```

- [ ] **Step 2: Adicionar função de upload separada**

```typescript
const handleUploadFoto = async (file: File) => {
  setUploadando(true);
  try {
    await obrasService.uploadFotoCapa(obra.id, file);
    queryClient.invalidateQueries({ queryKey: ['obras'] });
  } catch {
    // silencioso — o usuário vê o preview mas sabe que pode ter falhado
  } finally {
    setUploadando(false);
  }
};
```

- [ ] **Step 3: Adicionar campo de foto no formulário do modal**

No JSX do modal, adicionar como primeiro campo (antes do campo "Nome"):

```tsx
{/* Foto de capa */}
<div style={{ marginBottom: '16px' }}>
  <label style={labelStyle}>Foto de capa</label>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {fotoPreview ? (
      <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden' }}>
        <img src={fotoPreview} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {uploadando && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '13px',
          }}>
            Enviando...
          </div>
        )}
        <label style={{
          position: 'absolute', bottom: '6px', right: '6px',
          background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '6px',
          padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
        }}>
          Trocar
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFotoPreview(URL.createObjectURL(file));
              setFotoCapa(file);
              await handleUploadFoto(file);
            }}
          />
        </label>
      </div>
    ) : (
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '72px', border: '1px dashed var(--bg-border)',
        borderRadius: '8px', cursor: 'pointer',
        color: 'var(--text-60)', fontSize: '13px', gap: '8px',
        background: 'var(--bg-surface)',
      }}>
        📷 Adicionar foto de capa
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setFotoPreview(URL.createObjectURL(file));
            setFotoCapa(file);
            await handleUploadFoto(file);
          }}
        />
      </label>
    )}
  </div>
</div>
```

- [ ] **Step 4: Testar no browser**

Abrir modal de edição de uma obra existente. Adicionar foto. Fechar modal. Confirmar que o card na grade exibe a foto.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/obras/EditarObraModal.tsx
git commit -m "feat: foto capa upload in EditarObraModal"
```

---

## Verificação final

- [ ] Grade de obras: cards com foto mostram imagem; sem foto mostram gradient do `obra.id`
- [ ] Counters: inspeções, fotos, locais visíveis em todos os cards
- [ ] Barra de prazo: vermelha para vencido, amarela para >80%, laranja para normal, oculta sem datas
- [ ] Toggle grid/lista/kanban: todos os modos ainda funcionam
- [ ] Semáforo PBQP-H: aparece no footer dos cards PBQP-H
- [ ] Foto quebrada: card cai de volta para gradient (testar com URL inválida no banco)
- [ ] Upload > 10MB: rejeitado com mensagem
- [ ] Formato inválido: rejeitado com mensagem

```bash
cd backend && npm run build && npm run test
```
