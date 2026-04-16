# FVS Sprint 4b — NCs Explícitas + Ciclo de Status Completo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo de não conformidades com 8 estados de registro, tabelas NC explícitas, inspeção em massa e parecer lock.

**Architecture:** Toda a lógica fica no `InspecaoService` via raw SQL (padrão do projeto). `putRegistro` valida transições de estado e auto-cria `fvs_nao_conformidades`. Novos endpoints bulk e NCs são adicionados ao controller existente.

**Tech Stack:** NestJS, Prisma `$queryRawUnsafe`/`$executeRawUnsafe`, PostgreSQL, class-validator DTOs. Backend em `/backend/src/fvs/inspecao/`. Build: `npm run build` em `backend/`.

**Dependência:** Nenhuma — este sprint é backend-only. Sprint 5 (grade visual) depende dos novos `StatusGrade` definidos aqui.

---

## Arquivo-por-arquivo

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/prisma/migrations/20260413100000_fvs_sprint4b_nc_ciclo/migration.sql` | Criar | Adicionar colunas em `fvs_registros`, criar tabelas NC |
| `backend/src/fvs/types/fvs.types.ts` | Modificar | Estender `StatusRegistro` (8 valores), `StatusGrade` (7 valores), adicionar tipos NC |
| `backend/src/fvs/inspecao/dto/put-registro.dto.ts` | Modificar | Aceitar 8 valores em `@IsEnum` |
| `backend/src/fvs/inspecao/dto/bulk-inspecao.dto.ts` | Criar | DTO para inspeção em massa |
| `backend/src/fvs/inspecao/dto/registrar-tratamento.dto.ts` | Criar | DTO para tratamento de NC |
| `backend/src/fvs/inspecao/inspecao.service.ts` | Modificar | `putRegistro`, `calcularStatusCelula`, `bulkInspecaoLocais`, `getNcs`, `registrarTratamento` |
| `backend/src/fvs/inspecao/inspecao.controller.ts` | Modificar | 3 novas rotas: bulk, getNcs, tratamento |
| `backend/src/fvs/inspecao/inspecao.service.spec.ts` | Modificar | Testes dos novos comportamentos |

---

## Task 1: Migration — tabelas NC + colunas ciclo

**Files:**
- Create: `backend/prisma/migrations/20260413100000_fvs_sprint4b_nc_ciclo/migration.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- migration: 20260413100000_fvs_sprint4b_nc_ciclo
-- Sprint 4b: ciclo reaberto + fvs_nao_conformidades + fvs_nc_tratamentos

-- 1. fvs_registros: campos de reabertura de ciclo
ALTER TABLE fvs_registros
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_por INT REFERENCES "Usuario"(id),
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_em  TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fvs_reg_status_tenant
  ON fvs_registros (tenant_id, ficha_id, status);

-- 2. fvs_nao_conformidades
CREATE TABLE IF NOT EXISTS fvs_nao_conformidades (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  ficha_id          INT NOT NULL REFERENCES fvs_fichas(id) ON DELETE RESTRICT,
  registro_id       INT NOT NULL REFERENCES fvs_registros(id) ON DELETE RESTRICT,
  numero            VARCHAR(60) NOT NULL,
  servico_id        INT NOT NULL,
  item_id           INT NOT NULL,
  obra_local_id     INT NOT NULL,
  criticidade       VARCHAR(20) NOT NULL DEFAULT 'menor',
  status            VARCHAR(40) NOT NULL DEFAULT 'aberta',
  ciclo_numero      INT NOT NULL DEFAULT 1,
  responsavel_id    INT,
  prazo_resolucao   DATE,
  acao_corretiva    TEXT,
  causa_raiz        TEXT,
  sla_prazo_dias    INT,
  sla_status        VARCHAR(20) DEFAULT 'no_prazo',
  encerrada_em      TIMESTAMP,
  encerrada_por     INT,
  resultado_final   VARCHAR(40),
  criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
  criado_por        INT NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nc_ficha
  ON fvs_nao_conformidades (ficha_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_nc_status
  ON fvs_nao_conformidades (status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_nc_sla
  ON fvs_nao_conformidades (sla_status, tenant_id);

-- 3. fvs_nc_tratamentos
CREATE TABLE IF NOT EXISTS fvs_nc_tratamentos (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  nc_id           INT NOT NULL REFERENCES fvs_nao_conformidades(id) ON DELETE CASCADE,
  ciclo_numero    INT NOT NULL,
  descricao       TEXT NOT NULL,
  acao_corretiva  TEXT,
  responsavel_id  INT NOT NULL,
  prazo           DATE,
  evidencias      JSONB,
  registrado_por  INT NOT NULL,
  criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Aplicar migration**

```bash
cd backend
npx prisma migrate resolve --applied 20260413100000_fvs_sprint4b_nc_ciclo
# OU se a migration já tem migration.sql:
npx prisma db execute --file prisma/migrations/20260413100000_fvs_sprint4b_nc_ciclo/migration.sql
```

Expected: sem erros. Verificar com:
```bash
psql $DATABASE_URL -c "\d fvs_nao_conformidades"
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/migrations/20260413100000_fvs_sprint4b_nc_ciclo/migration.sql
git commit -m "feat(fvs): migration sprint4b — fvs_nao_conformidades + fvs_nc_tratamentos"
```

---

## Task 2: Estender tipos TypeScript

**Files:**
- Modify: `backend/src/fvs/types/fvs.types.ts`

- [ ] **Step 1: Escrever testes de tipo (verificação de compilação)**

Não há teste unitário para types — a compilação do TypeScript valida. Prosseguir direto à implementação.

- [ ] **Step 2: Atualizar `StatusRegistro`, `StatusGrade` e adicionar tipos NC**

No arquivo `backend/src/fvs/types/fvs.types.ts`, substituir as linhas:

```typescript
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';
export type StatusGrade = 'nao_avaliado' | 'aprovado' | 'nc' | 'pendente';
```

Por:

```typescript
export type StatusRegistro =
  | 'nao_avaliado'
  | 'conforme'
  | 'nao_conforme'
  | 'excecao'
  | 'conforme_apos_reinspecao'  // NC corrigida — estado final ✅
  | 'nc_apos_reinspecao'         // NC permanece — estado final ❌
  | 'liberado_com_concessao'     // liberado com ressalva
  | 'retrabalho';                // reabre o ciclo

export type StatusGrade =
  | 'nao_avaliado'
  | 'parcial'         // alguns itens avaliados, não todos
  | 'aprovado'        // todos conforme/conforme_apos_reinspecao/excecao
  | 'nc'              // ao menos 1 nao_conforme ou retrabalho
  | 'nc_final'        // ao menos 1 nc_apos_reinspecao sem nao_conforme pendente
  | 'liberado'        // liberado_com_concessao (todos resolvidos)
  | 'pendente';       // ao menos 1 nao_avaliado restante
```

- [ ] **Step 3: Adicionar tipos NC ao final do arquivo** (após `FvsModelo` types)

```typescript
// ─── Sprint 4b: NCs Explícitas ───────────────────────────────────────────────

export type StatusNc = 'aberta' | 'em_tratamento' | 'aguardando_reinspecao' | 'encerrada' | 'cancelada';
export type SlaStatus = 'no_prazo' | 'alerta' | 'vencido';

export interface FvsNaoConformidade {
  id: number;
  tenant_id: number;
  ficha_id: number;
  registro_id: number;
  numero: string;
  servico_id: number;
  item_id: number;
  obra_local_id: number;
  criticidade: Criticidade;
  status: StatusNc;
  ciclo_numero: number;
  responsavel_id: number | null;
  prazo_resolucao: string | null;  // DATE → string
  acao_corretiva: string | null;
  causa_raiz: string | null;
  sla_prazo_dias: number | null;
  sla_status: SlaStatus;
  encerrada_em: Date | null;
  encerrada_por: number | null;
  resultado_final: string | null;
  criado_em: Date;
  criado_por: number;
  // joined
  servico_nome?: string;
  item_descricao?: string;
  local_nome?: string;
}

export interface FvsNcTratamento {
  id: number;
  tenant_id: number;
  nc_id: number;
  ciclo_numero: number;
  descricao: string;
  acao_corretiva: string | null;
  responsavel_id: number;
  prazo: string | null;
  evidencias: { ged_versao_id: number; descricao?: string }[] | null;
  registrado_por: number;
  criado_em: Date;
}
```

- [ ] **Step 4: Verificar compilação**

```bash
cd backend && npm run build 2>&1 | grep -E "error|Error"
```

Expected: sem erros de tipos.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/types/fvs.types.ts
git commit -m "feat(fvs): estender StatusRegistro (8 valores), StatusGrade (7 valores), adicionar tipos NC"
```

---

## Task 3: Atualizar DTO `PutRegistroDto`

**Files:**
- Modify: `backend/src/fvs/inspecao/dto/put-registro.dto.ts`

- [ ] **Step 1: Escrever teste que falha**

No arquivo `backend/src/fvs/inspecao/inspecao.service.spec.ts`, adicionar dentro do `describe('putRegistro()')`:

```typescript
it('aceita status conforme_apos_reinspecao sem lançar erro de validação', async () => {
  // O DTO usa @IsEnum — se o enum não incluir o novo valor, o controller rejeita.
  // Este teste verifica que o service aceita o valor (validação DTO é feita pelo NestJS pipes).
  mockPrisma.$queryRawUnsafe
    .mockResolvedValueOnce([FICHA_EM_INSPECAO])            // getFichaOuFalhar
    .mockResolvedValueOnce([{ criticidade: 'menor' }])     // buscar criticidade
    .mockResolvedValueOnce([{ id: 5, ficha_id: 1, status: 'conforme_apos_reinspecao', ciclo: 2 }]); // upsert

  const dto = { servicoId: 1, itemId: 1, localId: 1, status: 'conforme_apos_reinspecao' as any, ciclo: 2 };
  const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, dto, '127.0.0.1');
  expect(result.status).toBe('conforme_apos_reinspecao');
});
```

- [ ] **Step 2: Rodar teste para verificar que falha** (vai falhar por TransitionError antes de retornar)

```bash
cd backend && npx jest inspecao.service.spec.ts -t "aceita status conforme_apos_reinspecao" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — transição inválida (ainda não implementada no service).

- [ ] **Step 3: Atualizar DTO**

Substituir todo o conteúdo de `backend/src/fvs/inspecao/dto/put-registro.dto.ts`:

```typescript
// backend/src/fvs/inspecao/dto/put-registro.dto.ts
import { IsNumber, IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';

const STATUS_REGISTRO_VALORES = [
  'nao_avaliado',
  'conforme',
  'nao_conforme',
  'excecao',
  'conforme_apos_reinspecao',
  'nc_apos_reinspecao',
  'liberado_com_concessao',
  'retrabalho',
] as const;

export class PutRegistroDto {
  @IsNumber()
  servicoId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  localId: number;

  @IsEnum(STATUS_REGISTRO_VALORES)
  status: typeof STATUS_REGISTRO_VALORES[number];

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ciclo?: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/fvs/inspecao/dto/put-registro.dto.ts
git commit -m "feat(fvs): PutRegistroDto aceita 8 valores de StatusRegistro"
```

---

## Task 4: Criar DTOs `BulkInspecaoDto` e `RegistrarTratamentoDto`

**Files:**
- Create: `backend/src/fvs/inspecao/dto/bulk-inspecao.dto.ts`
- Create: `backend/src/fvs/inspecao/dto/registrar-tratamento.dto.ts`

- [ ] **Step 1: Criar `bulk-inspecao.dto.ts`**

```typescript
// backend/src/fvs/inspecao/dto/bulk-inspecao.dto.ts
import { IsNumber, IsEnum, IsOptional, IsString, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkInspecaoDto {
  @IsNumber()
  servicoId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsNumber({}, { each: true })
  localIds: number[];

  @IsEnum(['conforme', 'excecao'])
  status: 'conforme' | 'excecao';

  @IsOptional()
  @IsString()
  observacao?: string;
}
```

- [ ] **Step 2: Criar `registrar-tratamento.dto.ts`**

```typescript
// backend/src/fvs/inspecao/dto/registrar-tratamento.dto.ts
import {
  IsString, MaxLength, IsNumber, IsDateString, IsOptional, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EvidenciaDto {
  @IsNumber()
  gedVersaoId: number;

  @IsOptional()
  @IsString()
  descricao?: string;
}

export class RegistrarTratamentoDto {
  @IsString()
  @MaxLength(500)
  descricao: string;

  @IsString()
  @MaxLength(500)
  acaoCorretiva: string;

  @IsNumber()
  responsavelId: number;

  @IsDateString()
  prazo: string;  // ISO date string, deve ser >= hoje

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenciaDto)
  evidencias?: EvidenciaDto[];
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/fvs/inspecao/dto/bulk-inspecao.dto.ts backend/src/fvs/inspecao/dto/registrar-tratamento.dto.ts
git commit -m "feat(fvs): adicionar BulkInspecaoDto e RegistrarTratamentoDto"
```

---

## Task 5: `putRegistro` — validação de transições e parecer lock

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Test: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever testes que falham**

Adicionar no `describe('putRegistro()')` em `inspecao.service.spec.ts`:

```typescript
const FICHA_APROVADA = { ...FICHA_RASCUNHO, status: 'aprovada' };

describe('putRegistro() — validações Sprint 4b', () => {
  it('lança ConflictException (409) com mensagem específica para ficha aprovada', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_APROVADA]);
    await expect(
      svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'conforme' }, '127.0.0.1'),
    ).rejects.toThrow('Ficha aprovada. Nenhuma alteração permitida.');
  });

  it('lança UnprocessableEntityException para transição inválida conforme→conforme_apos_reinspecao', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])          // getFichaOuFalhar
      .mockResolvedValueOnce([{ status: 'conforme' }]);    // buscar registro atual

    await expect(
      svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'conforme_apos_reinspecao' }, '127.0.0.1'),
    ).rejects.toThrow('Transição inválida: conforme → conforme_apos_reinspecao');
  });

  it('lança BadRequestException para nao_conforme sem observacao (qualquer regime)', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
      .mockResolvedValueOnce([{ status: 'nao_avaliado' }]);

    await expect(
      svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme' }, '127.0.0.1'),
    ).rejects.toThrow('Observação é obrigatória para não conformidade');
  });

  it('lança BadRequestException para nc_apos_reinspecao sem observacao', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
      .mockResolvedValueOnce([{ status: 'nao_conforme' }]);

    await expect(
      svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nc_apos_reinspecao' }, '127.0.0.1'),
    ).rejects.toThrow('Observação é obrigatória para NC após reinspeção');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "putRegistro" --no-coverage 2>&1 | tail -30
```

Expected: FAIL nos 4 novos testes.

- [ ] **Step 3: Implementar em `inspecao.service.ts`**

Ao início do arquivo, após `TRANSICOES_VALIDAS`, adicionar:

```typescript
// Transições válidas para status de registro individual
const TRANSICOES_REGISTRO: Record<string, string[]> = {
  nao_avaliado:             ['conforme', 'nao_conforme', 'excecao'],
  conforme:                 ['nao_conforme'],
  nao_conforme:             ['conforme_apos_reinspecao', 'nc_apos_reinspecao', 'liberado_com_concessao', 'retrabalho'],
  excecao:                  ['nao_conforme'],
  retrabalho:               ['conforme', 'nao_conforme', 'excecao'],
  conforme_apos_reinspecao: [],  // estado final
  nc_apos_reinspecao:       [],  // estado final (reabrir requer permissão especial)
  liberado_com_concessao:   [],  // estado final
};
```

Substituir o método `putRegistro` completo (linhas 645–707):

```typescript
async putRegistro(
  tenantId: number,
  fichaId: number,
  userId: number,
  dto: PutRegistroDto,
  ip?: string,
): Promise<FvsRegistroComCiclo> {
  const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

  // Parecer lock: ficha aprovada bloqueia qualquer alteração
  if (ficha.status === 'aprovada') {
    throw new ConflictException('Ficha aprovada. Nenhuma alteração permitida.');
  }

  if (ficha.status !== 'em_inspecao') {
    throw new ConflictException('Registros só podem ser gravados com ficha em_inspecao');
  }

  // Buscar status atual do registro para validar transição
  const ciclo = dto.ciclo ?? 1;
  const registroAtualRows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
    `SELECT status FROM fvs_registros
     WHERE ficha_id = $1 AND item_id = $2 AND obra_local_id = $3 AND ciclo = $4 AND tenant_id = $5
     LIMIT 1`,
    fichaId, dto.itemId, dto.localId, ciclo, tenantId,
  );
  const statusAtual = registroAtualRows[0]?.status ?? 'nao_avaliado';

  // Validar transição
  const transicoesPermitidas = TRANSICOES_REGISTRO[statusAtual] ?? [];
  if (dto.status !== statusAtual && !transicoesPermitidas.includes(dto.status)) {
    throw new UnprocessableEntityException(
      `Transição inválida: ${statusAtual} → ${dto.status}`,
    );
  }

  // Observação obrigatória (todos os regimes)
  if (dto.status === 'nao_conforme' && !dto.observacao?.trim()) {
    throw new BadRequestException('Observação é obrigatória para não conformidade');
  }
  if (dto.status === 'nc_apos_reinspecao' && !dto.observacao?.trim()) {
    throw new BadRequestException('Observação é obrigatória para NC após reinspeção');
  }

  // Buscar criticidade do item (para audit_log)
  const itemRows = await this.prisma.$queryRawUnsafe<{ criticidade: string }[]>(
    `SELECT criticidade FROM fvs_catalogo_itens WHERE id = $1 AND tenant_id IN (0, $2)`,
    dto.itemId, tenantId,
  );
  const criticidade = itemRows[0]?.criticidade ?? 'menor';

  // Upsert registro
  const rows = await this.prisma.$queryRawUnsafe<FvsRegistroComCiclo[]>(
    `INSERT INTO fvs_registros
       (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, observacao, inspecionado_por, inspecionado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO UPDATE SET
       status           = EXCLUDED.status,
       observacao       = EXCLUDED.observacao,
       inspecionado_por = EXCLUDED.inspecionado_por,
       inspecionado_em  = EXCLUDED.inspecionado_em,
       updated_at       = NOW()
     RETURNING *`,
    tenantId, fichaId, dto.servicoId, dto.itemId, dto.localId, ciclo,
    dto.status, dto.observacao ?? null, userId,
  );

  const registro = rows[0];

  // Auto-criar NC ao transicionar PARA nao_conforme
  if (dto.status === 'nao_conforme' && statusAtual !== 'nao_conforme') {
    await this.autoCreateNc(tenantId, fichaId, registro.id, dto, criticidade, userId, ciclo);
  }

  // Encerrar NC ao transicionar DE nao_conforme
  if (
    statusAtual === 'nao_conforme' &&
    ['conforme_apos_reinspecao', 'liberado_com_concessao', 'nc_apos_reinspecao'].includes(dto.status)
  ) {
    await this.encerrarNc(tenantId, registro.id, dto.status, userId);
  }

  // Audit log (todos os regimes — os 4 novos estados também são relevantes)
  if (ficha.regime === 'pbqph' || ['nao_conforme', 'conforme_apos_reinspecao', 'nc_apos_reinspecao', 'liberado_com_concessao'].includes(dto.status)) {
    await this.gravarAuditLog(this.prisma, {
      tenantId, fichaId, usuarioId: userId,
      acao: 'inspecao', registroId: registro.id, ip,
      statusDe: statusAtual !== dto.status ? statusAtual : undefined,
      statusPara: dto.status,
      detalhes: { itemId: dto.itemId, localId: dto.localId, criticidade, ciclo },
    });
  }

  // Sprint 3: se ciclo > 1 (reinspeção), verificar avanço do RO
  if (ciclo > 1) {
    await this.roService.checkAndAdvanceRoStatus(tenantId, fichaId);
  }

  return registro;
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "putRegistro" --no-coverage 2>&1 | tail -30
```

Expected: todos os testes de `putRegistro` passam.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): putRegistro — transições de status, parecer lock, observação obrigatória"
```

---

## Task 6: `autoCreateNc` e `encerrarNc` — helpers privados

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Test: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever teste que falha**

Adicionar em `inspecao.service.spec.ts`:

```typescript
describe('putRegistro() — auto-criação de NC', () => {
  it('cria fvs_nao_conformidades ao transicionar para nao_conforme', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])           // getFichaOuFalhar
      .mockResolvedValueOnce([])                             // registroAtual (nao_avaliado)
      .mockResolvedValueOnce([{ criticidade: 'maior' }])    // buscar criticidade
      .mockResolvedValueOnce([{ id: 7, ficha_id: 1, status: 'nao_conforme', ciclo: 1 }]) // upsert registro
      // autoCreateNc:
      .mockResolvedValueOnce([])                             // verificar NC existente
      .mockResolvedValueOnce([{ seq: 1 }])                  // próximo seq
      .mockResolvedValueOnce([{ codigo: 'ALV' }])           // codigo do serviço
      .mockResolvedValueOnce([{ id: 1, numero: 'NC-1-ALV-001' }]); // INSERT NC

    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

    await svc.putRegistro(TENANT_ID, 1, USER_ID, {
      servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme', observacao: 'Junta fora da tolerância',
    }, '127.0.0.1');

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fvs_nao_conformidades'),
      expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(),
    );
  });

  it('encerra NC ao transicionar para conforme_apos_reinspecao', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])
      .mockResolvedValueOnce([{ status: 'nao_conforme' }])   // status atual
      .mockResolvedValueOnce([{ criticidade: 'menor' }])
      .mockResolvedValueOnce([{ id: 9, ficha_id: 1, status: 'conforme_apos_reinspecao', ciclo: 2 }]) // upsert
      .mockResolvedValueOnce([{ id: 3 }]);                  // encerrarNc: UPDATE NC

    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

    await svc.putRegistro(TENANT_ID, 1, USER_ID, {
      servicoId: 1, itemId: 1, localId: 1, status: 'conforme_apos_reinspecao', observacao: 'Corrigido', ciclo: 2,
    }, '127.0.0.1');

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fvs_nao_conformidades'),
      'encerrada', 'conforme_apos_reinspecao',
      expect.anything(), expect.anything(), expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "auto-criação de NC" --no-coverage 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Implementar `autoCreateNc` e `encerrarNc` no service**

Adicionar após o método `putRegistro` em `inspecao.service.ts`:

```typescript
private async autoCreateNc(
  tenantId: number,
  fichaId: number,
  registroId: number,
  dto: { servicoId: number; itemId: number; localId: number; observacao?: string },
  criticidade: string,
  userId: number,
  ciclo: number,
): Promise<void> {
  // Verificar se já existe NC para este registro + ciclo
  const existentes = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM fvs_nao_conformidades
     WHERE registro_id = $1 AND ciclo_numero = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    registroId, ciclo, tenantId,
  );
  if (existentes.length > 0) return;  // já existe — idempotente

  // Próximo seq para esta ficha
  const seqRows = await this.prisma.$queryRawUnsafe<{ seq: number }[]>(
    `SELECT COUNT(*)::int + 1 AS seq FROM fvs_nao_conformidades WHERE ficha_id = $1 AND tenant_id = $2`,
    fichaId, tenantId,
  );
  const seq = seqRows[0]?.seq ?? 1;

  // Código do serviço
  const svcRows = await this.prisma.$queryRawUnsafe<{ codigo: string | null }[]>(
    `SELECT codigo FROM fvs_catalogo_servicos WHERE id = $1 AND tenant_id IN (0, $2)`,
    dto.servicoId, tenantId,
  );
  const codigoServico = svcRows[0]?.codigo ?? String(dto.servicoId);
  const numero = `NC-${fichaId}-${codigoServico}-${String(seq).padStart(3, '0')}`;

  await this.prisma.$queryRawUnsafe(
    `INSERT INTO fvs_nao_conformidades
       (tenant_id, ficha_id, registro_id, numero, servico_id, item_id, obra_local_id,
        criticidade, status, ciclo_numero, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'aberta', $9, $10)`,
    tenantId, fichaId, registroId, numero,
    dto.servicoId, dto.itemId, dto.localId,
    criticidade, ciclo, userId,
  );
}

private async encerrarNc(
  tenantId: number,
  registroId: number,
  resultadoFinal: string,
  userId: number,
): Promise<void> {
  await this.prisma.$queryRawUnsafe(
    `UPDATE fvs_nao_conformidades
     SET status = $1, resultado_final = $2, encerrada_em = NOW(), encerrada_por = $3, updated_at = NOW()
     WHERE registro_id = $4 AND tenant_id = $5 AND status NOT IN ('encerrada', 'cancelada')`,
    'encerrada', resultadoFinal, userId, registroId, tenantId,
  );
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "auto-criação de NC" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): autoCreateNc e encerrarNc — NC explícita ao transicionar status"
```

---

## Task 7: Atualizar `calcularStatusCelula`

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Test: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever testes que falham**

Adicionar em `inspecao.service.spec.ts`:

```typescript
describe('calcularStatusCelula() — Sprint 4b', () => {
  // Acessa via (svc as any) pois é método privado
  it('retorna nc quando há nao_conforme', () => {
    expect((svc as any).calcularStatusCelula(['conforme', 'nao_conforme'])).toBe('nc');
  });
  it('retorna nc quando há retrabalho', () => {
    expect((svc as any).calcularStatusCelula(['conforme', 'retrabalho'])).toBe('nc');
  });
  it('retorna nc_final quando há nc_apos_reinspecao e não há nao_conforme', () => {
    expect((svc as any).calcularStatusCelula(['conforme', 'nc_apos_reinspecao'])).toBe('nc_final');
  });
  it('prefere nc sobre nc_final quando ambos presentes', () => {
    expect((svc as any).calcularStatusCelula(['nao_conforme', 'nc_apos_reinspecao'])).toBe('nc');
  });
  it('retorna parcial quando há nao_avaliado misturado com avaliado', () => {
    expect((svc as any).calcularStatusCelula(['conforme', 'nao_avaliado'])).toBe('parcial');
  });
  it('retorna nao_avaliado quando todos são nao_avaliado', () => {
    expect((svc as any).calcularStatusCelula(['nao_avaliado', 'nao_avaliado'])).toBe('nao_avaliado');
  });
  it('retorna aprovado quando todos são conforme/conforme_apos_reinspecao/excecao', () => {
    expect((svc as any).calcularStatusCelula(['conforme', 'conforme_apos_reinspecao', 'excecao'])).toBe('aprovado');
  });
  it('retorna liberado quando todos são liberado_com_concessao', () => {
    expect((svc as any).calcularStatusCelula(['liberado_com_concessao', 'liberado_com_concessao'])).toBe('liberado');
  });
  it('retorna pendente para mix de liberado+conforme+avaliado', () => {
    expect((svc as any).calcularStatusCelula(['liberado_com_concessao', 'conforme_apos_reinspecao'])).toBe('aprovado');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "calcularStatusCelula" --no-coverage 2>&1 | tail -20
```

Expected: vários FAIL.

- [ ] **Step 3: Substituir `calcularStatusCelula` no service**

```typescript
private calcularStatusCelula(statuses: string[]): StatusGrade {
  if (!statuses.length) return 'nao_avaliado';

  // Prioridade 1: NC ativa (nao_conforme ou retrabalho em curso)
  if (statuses.some(s => s === 'nao_conforme' || s === 'retrabalho')) return 'nc';

  // Prioridade 2: NC permanente após reinspeção
  if (statuses.some(s => s === 'nc_apos_reinspecao')) return 'nc_final';

  // Prioridade 3: todos não avaliados
  if (statuses.every(s => s === 'nao_avaliado')) return 'nao_avaliado';

  // Prioridade 4: mix com não avaliados
  if (statuses.some(s => s === 'nao_avaliado')) return 'parcial';

  // Prioridade 5: todos aprovados (conforme + pós-reinspeção + exceção)
  const APROVADOS = new Set(['conforme', 'conforme_apos_reinspecao', 'excecao', 'liberado_com_concessao']);
  if (statuses.every(s => APROVADOS.has(s))) {
    if (statuses.every(s => s === 'liberado_com_concessao')) return 'liberado';
    return 'aprovado';
  }

  return 'pendente';
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "calcularStatusCelula" --no-coverage 2>&1 | tail -20
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): calcularStatusCelula — 7 estados (parcial, nc_final, liberado)"
```

---

## Task 8: `bulkInspecaoLocais`

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.controller.ts`
- Test: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever testes que falham**

Adicionar em `inspecao.service.spec.ts`:

```typescript
describe('bulkInspecaoLocais()', () => {
  it('lança BadRequestException se status=nao_conforme', async () => {
    await expect(
      svc.bulkInspecaoLocais(TENANT_ID, 1, USER_ID, {
        servicoId: 1, localIds: [1, 2], status: 'nao_conforme' as any,
      }, '127.0.0.1'),
    ).rejects.toThrow('Inspeção em massa não permite não conformidade');
  });

  it('processa apenas locais nao_avaliado, ignora os avaliados', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])  // getFichaOuFalhar
      // getItensDoServico (retorna 2 itens)
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
      // getRegistrosAtuais para local 1 e local 2 → local 1 já avaliado (conforme), local 2 nao_avaliado
      .mockResolvedValueOnce([{ item_id: 10, obra_local_id: 1, status: 'conforme' }, { item_id: 11, obra_local_id: 1, status: 'conforme' }])
      .mockResolvedValueOnce([]);  // local 2 sem registros = nao_avaliado

    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

    const result = await svc.bulkInspecaoLocais(TENANT_ID, 1, USER_ID, {
      servicoId: 1, localIds: [1, 2], status: 'conforme',
    }, '127.0.0.1');

    // local 1 ignorado, local 2 processado
    expect(result.processados).toBe(1);
    expect(result.ignorados).toBe(1);
    expect(result.erros).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "bulkInspecaoLocais" --no-coverage 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Implementar `bulkInspecaoLocais` no service**

Adicionar após `encerrarNc`:

```typescript
async bulkInspecaoLocais(
  tenantId: number,
  fichaId: number,
  userId: number,
  dto: { servicoId: number; localIds: number[]; status: 'conforme' | 'excecao'; observacao?: string },
  ip?: string,
): Promise<{ processados: number; ignorados: number; erros: number }> {
  if ((dto.status as string) === 'nao_conforme') {
    throw new BadRequestException('Inspeção em massa não permite não conformidade');
  }

  const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
  if (ficha.status !== 'em_inspecao') {
    throw new ConflictException('Registros só podem ser gravados com ficha em_inspecao');
  }

  // Buscar todos os itens do serviço para esta ficha
  const itensRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT i.id
     FROM fvs_catalogo_itens i
     JOIN fvs_ficha_servicos fs ON fs.servico_id = $1 AND fs.ficha_id = $2 AND fs.tenant_id = $3
     WHERE i.servico_id = $1 AND i.tenant_id IN (0, $3) AND i.ativo = true
       AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))`,
    dto.servicoId, fichaId, tenantId,
  );
  const itemIds = itensRows.map(r => r.id);
  if (itemIds.length === 0) return { processados: 0, ignorados: 0, erros: 0 };

  let processados = 0;
  let ignorados = 0;

  for (const localId of dto.localIds) {
    // Buscar registros atuais para este local
    const regsAtuais = await this.prisma.$queryRawUnsafe<{ item_id: number; status: string }[]>(
      `SELECT DISTINCT ON (item_id) item_id, status
       FROM fvs_registros
       WHERE ficha_id = $1 AND servico_id = $2 AND obra_local_id = $3 AND tenant_id = $4
       ORDER BY item_id, ciclo DESC`,
      fichaId, dto.servicoId, localId, tenantId,
    );

    const statusPorItem: Record<number, string> = {};
    regsAtuais.forEach(r => { statusPorItem[r.item_id] = r.status; });

    // Verificar se todos os itens estão nao_avaliado
    const todosNaoAvaliados = itemIds.every(id => !statusPorItem[id] || statusPorItem[id] === 'nao_avaliado');
    if (!todosNaoAvaliados) {
      ignorados++;
      continue;
    }

    // Inserir todos os itens como conforme/excecao
    for (const itemId of itemIds) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO fvs_registros
           (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, observacao, inspecionado_por, inspecionado_em)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, NOW())
         ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO NOTHING`,
        tenantId, fichaId, dto.servicoId, itemId, localId,
        dto.status, dto.observacao ?? null, userId,
      );
    }
    processados++;
  }

  return { processados, ignorados, erros: 0 };
}
```

- [ ] **Step 4: Adicionar rota no controller**

Em `inspecao.controller.ts`, adicionar import de `BulkInspecaoDto`:
```typescript
import { BulkInspecaoDto } from './dto/bulk-inspecao.dto';
```

Adicionar método no controller (após `putRegistro`):

```typescript
@Post('fichas/:fichaId/registros/bulk')
@Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
@HttpCode(HttpStatus.OK)
bulkInspecaoLocais(
  @TenantId() tenantId: number,
  @CurrentUser() user: JwtUser,
  @Param('fichaId', ParseIntPipe) fichaId: number,
  @Body() dto: BulkInspecaoDto,
  @Ip() ip: string,
) {
  return this.inspecao.bulkInspecaoLocais(tenantId, fichaId, user.id, dto, ip);
}
```

- [ ] **Step 5: Rodar testes**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "bulkInspecaoLocais" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.controller.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): bulkInspecaoLocais — POST fichas/:fichaId/registros/bulk"
```

---

## Task 9: `getNcs` + `registrarTratamento`

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.controller.ts`
- Test: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever testes que falham**

Adicionar em `inspecao.service.spec.ts`:

```typescript
describe('getNcs()', () => {
  it('retorna lista de NCs com filtros', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])
      .mockResolvedValueOnce([
        { id: 1, numero: 'NC-1-ALV-001', status: 'aberta', criticidade: 'maior',
          servico_nome: 'Alvenaria', item_descricao: 'Prumo', local_nome: 'Ap 101',
          sla_status: 'no_prazo', prazo_resolucao: null, criado_em: new Date() },
      ])
      .mockResolvedValueOnce([{ count: 1 }]); // total count

    const result = await svc.getNcs(TENANT_ID, 1, {});
    expect(result.total).toBe(1);
    expect(result.ncs[0].numero).toBe('NC-1-ALV-001');
  });
});

describe('registrarTratamento()', () => {
  it('insere tratamento e atualiza NC para em_tratamento', async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const prazoFuturo = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])
      .mockResolvedValueOnce([{ id: 3, status: 'aberta', ficha_id: 1 }]) // buscar NC
      .mockResolvedValueOnce([{ id: 10 }]); // INSERT tratamento

    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // UPDATE NC

    await svc.registrarTratamento(TENANT_ID, 1, 3, USER_ID, {
      descricao: 'Realinhamento', acaoCorretiva: 'Refazer fiadas', responsavelId: 5, prazo: prazoFuturo,
    });

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fvs_nao_conformidades'),
      'em_tratamento', expect.anything(), expect.anything(), 3, TENANT_ID,
    );
  });

  it('lança BadRequestException para prazo no passado', async () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([FICHA_EM_INSPECAO])
      .mockResolvedValueOnce([{ id: 3, status: 'aberta', ficha_id: 1 }]);

    await expect(
      svc.registrarTratamento(TENANT_ID, 1, 3, USER_ID, {
        descricao: 'X', acaoCorretiva: 'Y', responsavelId: 5, prazo: ontem,
      }),
    ).rejects.toThrow('Prazo deve ser igual ou posterior à data atual');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "getNcs|registrarTratamento" --no-coverage 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Implementar `getNcs` e `registrarTratamento` no service**

```typescript
async getNcs(
  tenantId: number,
  fichaId: number,
  filtros: {
    status?: string;
    criticidade?: string;
    servicoId?: number;
    slaStatus?: string;
  },
): Promise<{ total: number; ncs: FvsNaoConformidade[] }> {
  await this.getFichaOuFalhar(tenantId, fichaId);

  const params: unknown[] = [tenantId, fichaId];
  const conditions: string[] = ['nc.tenant_id = $1', 'nc.ficha_id = $2', 'nc.deleted_at IS NULL'];

  if (filtros.status) { params.push(filtros.status); conditions.push(`nc.status = $${params.length}`); }
  if (filtros.criticidade) { params.push(filtros.criticidade); conditions.push(`nc.criticidade = $${params.length}`); }
  if (filtros.servicoId) { params.push(filtros.servicoId); conditions.push(`nc.servico_id = $${params.length}`); }
  if (filtros.slaStatus) { params.push(filtros.slaStatus); conditions.push(`nc.sla_status = $${params.length}`); }

  const where = conditions.join(' AND ');

  const ncs = await this.prisma.$queryRawUnsafe<FvsNaoConformidade[]>(
    `SELECT nc.*,
            s.nome   AS servico_nome,
            i.descricao AS item_descricao,
            ol.nome  AS local_nome
     FROM fvs_nao_conformidades nc
     LEFT JOIN fvs_catalogo_servicos s ON s.id = nc.servico_id
     LEFT JOIN fvs_catalogo_itens    i ON i.id = nc.item_id
     LEFT JOIN obra_locais            ol ON ol.id = nc.obra_local_id
     WHERE ${where}
     ORDER BY nc.criado_em DESC`,
    ...params,
  );

  const countRows = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM fvs_nao_conformidades nc WHERE ${where}`,
    ...params,
  );

  return { total: countRows[0]?.count ?? 0, ncs };
}

async registrarTratamento(
  tenantId: number,
  fichaId: number,
  ncId: number,
  userId: number,
  dto: { descricao: string; acaoCorretiva: string; responsavelId: number; prazo: string; evidencias?: { gedVersaoId: number; descricao?: string }[] },
): Promise<void> {
  await this.getFichaOuFalhar(tenantId, fichaId);

  const ncRows = await this.prisma.$queryRawUnsafe<{ id: number; status: string; ficha_id: number }[]>(
    `SELECT id, status, ficha_id FROM fvs_nao_conformidades WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    ncId, tenantId,
  );
  if (!ncRows.length) throw new NotFoundException(`NC ${ncId} não encontrada`);
  const nc = ncRows[0];
  if (nc.status === 'encerrada' || nc.status === 'cancelada') {
    throw new ConflictException('NC já encerrada');
  }

  // Validar prazo
  const hoje = new Date().toISOString().slice(0, 10);
  if (dto.prazo < hoje) {
    throw new BadRequestException('Prazo deve ser igual ou posterior à data atual');
  }

  // Próximo ciclo_numero
  const cicloRows = await this.prisma.$queryRawUnsafe<{ max_ciclo: number | null }[]>(
    `SELECT MAX(ciclo_numero) AS max_ciclo FROM fvs_nc_tratamentos WHERE nc_id = $1`,
    ncId,
  );
  const cicloNumero = (cicloRows[0]?.max_ciclo ?? 0) + 1;

  await this.prisma.$queryRawUnsafe(
    `INSERT INTO fvs_nc_tratamentos
       (tenant_id, nc_id, ciclo_numero, descricao, acao_corretiva, responsavel_id, prazo, evidencias, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    tenantId, ncId, cicloNumero, dto.descricao, dto.acaoCorretiva,
    dto.responsavelId, dto.prazo, dto.evidencias ? JSON.stringify(dto.evidencias) : null, userId,
  );

  await this.prisma.$executeRawUnsafe(
    `UPDATE fvs_nao_conformidades
     SET status = $1, responsavel_id = $2, prazo_resolucao = $3, acao_corretiva = $4, updated_at = NOW()
     WHERE id = $5 AND tenant_id = $6`,
    'em_tratamento', dto.responsavelId, dto.prazo, dto.acaoCorretiva, ncId, tenantId,
  );
}
```

- [ ] **Step 4: Adicionar rotas no controller**

Adicionar imports:
```typescript
import { RegistrarTratamentoDto } from './dto/registrar-tratamento.dto';
```

Adicionar métodos no controller:

```typescript
// ─── NCs ─────────────────────────────────────────────────────────────────────

@Get('fichas/:id/ncs')
@Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
getNcs(
  @TenantId() tenantId: number,
  @Param('id', ParseIntPipe) fichaId: number,
  @Query('status') status?: string,
  @Query('criticidade') criticidade?: string,
  @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
  @Query('slaStatus') slaStatus?: string,
) {
  return this.inspecao.getNcs(tenantId, fichaId, { status, criticidade, servicoId, slaStatus });
}

@Post('fichas/:fichaId/ncs/:ncId/tratamento')
@Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
@HttpCode(HttpStatus.CREATED)
registrarTratamento(
  @TenantId() tenantId: number,
  @CurrentUser() user: JwtUser,
  @Param('fichaId', ParseIntPipe) fichaId: number,
  @Param('ncId', ParseIntPipe) ncId: number,
  @Body() dto: RegistrarTratamentoDto,
) {
  return this.inspecao.registrarTratamento(tenantId, fichaId, ncId, user.id, {
    descricao: dto.descricao,
    acaoCorretiva: dto.acaoCorretiva,
    responsavelId: dto.responsavelId,
    prazo: dto.prazo,
    evidencias: dto.evidencias?.map(e => ({ gedVersaoId: e.gedVersaoId, descricao: e.descricao })),
  });
}
```

- [ ] **Step 5: Rodar testes**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "getNcs|registrarTratamento" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.controller.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): getNcs + registrarTratamento — GET /ncs + POST /ncs/:id/tratamento"
```

---

## Task 10: Build, testes completos e validação final

**Files:** Nenhum adicional.

- [ ] **Step 1: Rodar todos os testes do módulo**

```bash
cd backend && npx jest src/fvs/inspecao/ --no-coverage 2>&1 | tail -30
```

Expected: todos PASS (nenhum teste regressado).

- [ ] **Step 2: Build completo**

```bash
cd backend && npm run build 2>&1 | grep -E "error|Error"
```

Expected: sem erros.

- [ ] **Step 3: Smoke test dos novos endpoints**

```bash
# Subir backend
kill $(lsof -ti :3000) 2>/dev/null; sleep 1
node dist/src/main.js > /tmp/eldox-backend.log 2>&1 &
sleep 3

# Obter token (ajustar credenciais conforme ambiente)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test@123"}' | jq -r '.data.token')

# Verificar que bulk endpoint existe
curl -s -X POST http://localhost:3000/api/v1/fvs/fichas/1/registros/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"servicoId":1,"localIds":[],"status":"conforme"}' | jq '.message'
# Expected: "localIds deve ter ao menos 1 elemento"

# Verificar que GET NCs existe
curl -s http://localhost:3000/api/v1/fvs/fichas/1/ncs \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
# Expected: ["data"] ou ["message":"Ficha X não encontrada"]
```

- [ ] **Step 4: Commit final do sprint 4b**

```bash
git add -A
git commit -m "feat(fvs): sprint 4b — NCs explícitas + ciclo de status completo

- 8 estados em StatusRegistro (conforme_apos_reinspecao, nc_apos_reinspecao, liberado_com_concessao, retrabalho)
- 7 estados em StatusGrade (parcial, nc_final, liberado)
- Auto-criação de fvs_nao_conformidades ao marcar nao_conforme
- Encerramento automático de NC ao reinspecionar
- POST fichas/:id/registros/bulk — inspeção em massa
- GET fichas/:id/ncs + POST fichas/:id/ncs/:id/tratamento
- Validação de transições de estado com TRANSICOES_REGISTRO"
```

---

## Critérios de Aceite

| CA | Verificação |
|----|------------|
| CA-01 | `PUT .../registros` aceita os 8 estados |
| CA-02 | NC sem observação retorna 400 |
| CA-03 | Transição inválida retorna 422 |
| CA-04 | Ficha `aprovada` retorna 409 |
| CA-05 | `nao_conforme` cria `fvs_nao_conformidades` automaticamente |
| CA-06 | `conforme_apos_reinspecao` encerra NC correspondente |
| CA-07 | Bulk processa locais `nao_avaliado`, ignora avaliados |
| CA-08 | Bulk com `nao_conforme` retorna 400 |
| CA-09 | `GET .../ncs` retorna lista com filtros |
| CA-10 | `POST .../tratamento` persiste e atualiza NC para `em_tratamento` |
| CA-11 | `calcularStatusCelula` reflete 7 estados |
| CA-12 | Todos os testes do módulo passam sem regressão |
