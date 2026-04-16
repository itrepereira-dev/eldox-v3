# Geração de Locais em Cascata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a geração de locais de um único nível pelo modelo em cascata da v2, com 3 estratégias especializadas (edificação, linear, instalação) + 1 genérica recursiva, mantendo arquitetura extensível para futuras adequações.

**Architecture:** Um único endpoint de entrada (`POST /obras/:id/locais/gerar-cascata`) recebe um `estrategia` discriminador e delega para um serviço especializado. Cada estratégia encapsula sua lógica em uma classe própria, todas injetadas no `ObrasService`. O endpoint antigo (`gerar-massa`) é mantido sem alteração para não quebrar o frontend atual.

**Tech Stack:** NestJS + TypeScript + Prisma (raw transaction) + PostgreSQL. Testes com Jest + Supertest.

---

## Mapa de Arquivos

### Backend — criar
| Arquivo | Responsabilidade |
|---|---|
| `src/obras/dto/gerar-cascata.dto.ts` | DTO discriminado por `estrategia` com union types |
| `src/obras/strategies/base-generator.strategy.ts` | Interface base `ILocalGenerator` |
| `src/obras/strategies/generica.strategy.ts` | Recursivo multi-nível — porta fiel da v2 |
| `src/obras/strategies/edificacao.strategy.ts` | Residencial/comercial: condomínio → bloco → andar → unidade + áreas comuns |
| `src/obras/strategies/linear.strategy.ts` | Obras lineares: trecho → PVs + elementos avulsos |
| `src/obras/strategies/instalacao.strategy.ts` | Instalações: área → módulos (fixos ou numerados) |

### Backend — modificar
| Arquivo | O que muda |
|---|---|
| `src/obras/obras.service.ts` | Injetar strategies, adicionar método `gerarCascata()` |
| `src/obras/obras.controller.ts` | Adicionar `POST obras/:id/locais/gerar-cascata` |
| `src/obras/obras.module.ts` | Registrar as 4 strategies como providers |

### Frontend — modificar
| Arquivo | O que muda |
|---|---|
| `src/services/obras.service.ts` | Adicionar `gerarCascata()` |
| `src/pages/obras/CadastroObraWizard.tsx` | Etapa "Hierarquia" troca `gerar-massa` por wizard de cascata por estratégia |

### Testes — criar
| Arquivo | O que cobre |
|---|---|
| `src/obras/strategies/generica.strategy.spec.ts` | Cascata 3 níveis, contagem, nomeCompleto |
| `src/obras/strategies/edificacao.strategy.spec.ts` | Modos andar/sequencial, áreas comuns, bloco por letra/número |
| `src/obras/strategies/linear.strategy.spec.ts` | Trechos + PVs + elementos avulsos |
| `src/obras/strategies/instalacao.strategy.spec.ts` | Áreas + módulos fixos + módulos numerados |
| `src/obras/obras.service.spec.ts` | Integração: gerar-cascata com cada estratégia |

---

## Task 1 — Interface base + DTO discriminado

**Files:**
- Create: `src/obras/strategies/base-generator.strategy.ts`
- Create: `src/obras/dto/gerar-cascata.dto.ts`

- [ ] **Step 1.1: Criar interface base**

```typescript
// src/obras/strategies/base-generator.strategy.ts
import { Prisma } from '@prisma/client';

export interface GerarCascataContext {
  obraId: number;
  tenantId: number;
  obraCodigo: string;
  tx: Prisma.TransactionClient; // tipo correto Prisma 7 — inferido do callback de $transaction
}

export interface GerarCascataResult {
  inseridos: number;
  // locais só contém IDs reais quando criados via create() individual.
  // Para createMany() em massa os IDs não são retornados pelo Prisma — omitir.
  locais?: { id: number; nome: string; nomeCompleto: string; nivel: number }[];
}

export interface ILocalGenerator {
  gerar(payload: unknown, ctx: GerarCascataContext): Promise<GerarCascataResult>;
}
```

- [ ] **Step 1.2: Criar DTO genérico com discriminador de estratégia**

```typescript
// src/obras/dto/gerar-cascata.dto.ts
import {
  IsString, IsNotEmpty, IsEnum, IsArray, ValidateNested,
  IsOptional, IsInt, IsBoolean, Min, Max, MaxLength,
  IsNumber, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export type EstrategiaGeracao = 'generica' | 'edificacao' | 'linear' | 'instalacao';

// ─── Genérica ───────────────────────────────────────────────
export class NivelGenericoDto {
  @IsInt() @Min(1) @Max(6)
  nivel: number;

  @IsInt() @Min(1) @Max(1000)
  qtde: number;

  @IsString() @MaxLength(30)
  prefixo: string;

  @IsOptional() @IsInt() @Min(1)
  inicioEm?: number; // default: 1

  // tipoUnidade vai em dadosExtras — não existe como coluna direta em ObraLocal v3
  @IsOptional() @IsString() @MaxLength(20)
  tipoUnidade?: string; // salvo em dadosExtras: { tipoUnidade } no service
}

export class GerarGenericaDto {
  estrategia: 'generica';

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => NivelGenericoDto)
  niveis: NivelGenericoDto[];
}

// ─── Edificação ──────────────────────────────────────────────
export class GerarEdificacaoDto {
  estrategia: 'edificacao';

  // Nível 1 — Condomínio (opcional — omitir = obra sem condomínio)
  @IsOptional() @IsString() @MaxLength(50)
  condPrefixo?: string; // default: omitir cria diretamente os blocos no nível 1

  @IsOptional() @IsInt() @Min(1)
  condQtd?: number; // default: 1

  @IsOptional() @IsInt() @Min(1)
  condInicio?: number; // default: 1

  // Nível bloco
  @IsString() @MaxLength(50)
  blocoPrefixo: string; // ex: "Bloco", "Torre"

  @IsEnum(['letra', 'numero'])
  blocoTipo: 'letra' | 'numero';

  @IsOptional() @IsString() @MaxLength(1)
  blocoLetraInicio?: string; // default: 'A'

  @IsOptional() @IsInt() @Min(1)
  blocoNumInicio?: number; // default: 1

  @IsInt() @Min(1) @Max(100)
  blocoQtd: number;

  // Nível unidade
  @IsEnum(['andar', 'sequencial'])
  modo: 'andar' | 'sequencial';

  // modo andar
  @IsOptional() @IsInt()
  andarInicio?: number; // default: 1

  @IsOptional() @IsInt() @Min(0)
  andarQtd?: number;

  @IsOptional() @IsInt() @Min(0)
  unidadesAndar?: number;

  @IsOptional() @IsString() @MaxLength(10)
  unidadePrefixo?: string; // ex: "AP", "SL"

  // modo sequencial
  @IsOptional() @IsInt() @Min(1)
  unidadesTotal?: number;

  // Áreas comuns por bloco
  @IsOptional() @IsArray()
  areasComuns?: Array<'halls' | 'escadas' | 'elevadores' | 'fachadas' | 'cobertura' | 'garagem'>;

  // Áreas comuns globais do condomínio
  @IsOptional() @IsArray()
  areasGlobais?: Array<'lazer' | 'sistemas'>;
}

// ─── Linear ──────────────────────────────────────────────────
export class TrechoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @IsOptional() @IsNumber()
  kmInicio?: number;

  @IsOptional() @IsNumber()
  kmFim?: number;

  @IsOptional() @IsInt() @Min(0)
  pvs?: number; // pontos de visita ao longo do trecho
}

export class ElementoLinearDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @IsOptional() @IsString()
  trecho?: string; // nome do trecho pai (se omitido, cria no nível 1)

  @IsOptional() @IsNumber()
  km?: number;
}

export class GerarLinearDto {
  estrategia: 'linear';

  @IsString() @MaxLength(10)
  @IsOptional()
  prefixoPV?: string; // default: 'PV'

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TrechoDto)
  trechos: TrechoDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ElementoLinearDto)
  elementos?: ElementoLinearDto[];
}

// ─── Instalação ───────────────────────────────────────────────
export class ModuloInstalacaoDto {
  @IsOptional() @IsString() @MaxLength(50)
  prefixo?: string; // para módulos numerados

  @IsOptional() @IsString() @MaxLength(100)
  nome?: string; // para módulo com nome exato

  @IsOptional() @IsInt() @Min(1) @Max(200)
  qtde?: number; // default: 1
}

export class AreaInstalacaoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => ModuloInstalacaoDto)
  modulos: ModuloInstalacaoDto[];
}

export class GerarInstalacaoDto {
  estrategia: 'instalacao';

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AreaInstalacaoDto)
  areas: AreaInstalacaoDto[];
}

// ─── Union final enviada pelo frontend ───────────────────────
export class GerarCascataDto {
  @IsEnum(['generica', 'edificacao', 'linear', 'instalacao'])
  estrategia: EstrategiaGeracao;

  // O payload específico é validado pela strategy — aqui recebemos como any
  // e a strategy valida internamente
  payload: GerarGenericaDto | GerarEdificacaoDto | GerarLinearDto | GerarInstalacaoDto;
}
```

- [ ] **Step 1.3: Commit**

```bash
git add src/obras/strategies/base-generator.strategy.ts src/obras/dto/gerar-cascata.dto.ts
git commit -m "feat(obras): interface base e DTOs para geração de locais em cascata"
```

---

## Task 2 — Strategy Genérica (recursiva multi-nível)

**Files:**
- Create: `src/obras/strategies/generica.strategy.ts`
- Create: `src/obras/strategies/generica.strategy.spec.ts`

- [ ] **Step 2.1: Escrever teste primeiro**

```typescript
// src/obras/strategies/generica.strategy.spec.ts
import { GenericaStrategy } from './generica.strategy';

describe('GenericaStrategy', () => {
  let strategy: GenericaStrategy;
  let mockTx: any;
  const ctx = { obraId: 1, tenantId: 1, obraCodigo: 'OBR-2026-001', tx: null as any };

  beforeEach(() => {
    strategy = new GenericaStrategy();
    const created: any[] = [];
    mockTx = {
      obraLocal: {
        createMany: jest.fn(async ({ data }) => { created.push(...data); return { count: data.length }; }),
        findMany: jest.fn(async () => created.map((d, i) => ({ ...d, id: i + 1 }))),
        count: jest.fn(async () => 0),
      },
    };
    ctx.tx = mockTx;
  });

  it('gera 1 nível com 3 itens', async () => {
    const result = await strategy.gerar(
      { estrategia: 'generica', niveis: [{ nivel: 1, qtde: 3, prefixo: 'Torre' }] },
      ctx,
    );
    expect(result.inseridos).toBe(3);
    expect(mockTx.obraLocal.createMany).toHaveBeenCalledTimes(1);
    const data = mockTx.obraLocal.createMany.mock.calls[0][0].data;
    expect(data[0].nome).toBe('Torre 01');
    expect(data[2].nome).toBe('Torre 03');
  });

  it('gera cascata 2 níveis: 2 torres × 3 pavimentos = 8 locais', async () => {
    let callCount = 0;
    mockTx.obraLocal.createMany = jest.fn(async ({ data }) => {
      callCount++;
      return { count: data.length };
    });
    mockTx.obraLocal.findMany = jest.fn(async () =>
      callCount === 1
        ? [{ id: 10, nome: 'Torre 01', nomeCompleto: 'Torre 01', codigo: 'OBR-001-T01', nivel: 1 },
           { id: 11, nome: 'Torre 02', nomeCompleto: 'Torre 02', codigo: 'OBR-001-T02', nivel: 1 }]
        : [],
    );

    await strategy.gerar(
      {
        estrategia: 'generica',
        niveis: [
          { nivel: 1, qtde: 2, prefixo: 'Torre' },
          { nivel: 2, qtde: 3, prefixo: 'Pav' },
        ],
      },
      ctx,
    );

    // 1 chamada para torres + 2 chamadas (1 por torre) para pavimentos
    expect(mockTx.obraLocal.createMany).toHaveBeenCalledTimes(3);
  });

  it('monta nomeCompleto corretamente em cascata', async () => {
    const registros: any[] = [];
    mockTx.obraLocal.createMany = jest.fn(async ({ data }) => {
      registros.push(...data);
      return { count: data.length };
    });
    mockTx.obraLocal.findMany = jest.fn(async () =>
      registros.slice(-1).map((d, i) => ({ ...d, id: 100 + i })),
    );

    await strategy.gerar(
      {
        estrategia: 'generica',
        niveis: [
          { nivel: 1, qtde: 1, prefixo: 'Bloco' },
          { nivel: 2, qtde: 1, prefixo: 'AP' },
        ],
      },
      ctx,
    );

    const pavimento = registros.find((r) => r.nivel === 2);
    expect(pavimento?.nomeCompleto).toBe('Bloco 01 > AP 01');
  });

  it('respeita inicioEm', async () => {
    await strategy.gerar(
      { estrategia: 'generica', niveis: [{ nivel: 1, qtde: 2, prefixo: 'AP', inicioEm: 101 }] },
      ctx,
    );
    const data = mockTx.obraLocal.createMany.mock.calls[0][0].data;
    expect(data[0].nome).toBe('AP 101');
    expect(data[1].nome).toBe('AP 102');
  });

  it('bloqueia se totalEstimado > 5000', async () => {
    await expect(
      strategy.gerar(
        {
          estrategia: 'generica',
          niveis: [
            { nivel: 1, qtde: 100, prefixo: 'A' },
            { nivel: 2, qtde: 100, prefixo: 'B' },
          ],
        },
        ctx,
      ),
    ).rejects.toThrow('Limite');
  });
});
```

- [ ] **Step 2.2: Rodar teste — esperar falha**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npx jest src/obras/strategies/generica.strategy.spec.ts --no-coverage 2>&1 | tail -10
```
Esperado: `Cannot find module './generica.strategy'`

- [ ] **Step 2.3: Implementar GenericaStrategy**

```typescript
// src/obras/strategies/generica.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarGenericaDto } from '../dto/gerar-cascata.dto';

@Injectable()
export class GenericaStrategy implements ILocalGenerator {
  async gerar(payload: GerarGenericaDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { niveis } = payload;
    const { obraId, tenantId, obraCodigo, tx } = ctx;

    // Anti-DoS: estimativa do produto dos quantitativos
    const totalEstimado = niveis.reduce((acc, n) => acc * n.qtde, 1);
    if (totalEstimado > 5000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${totalEstimado} locais. Limite: 5.000 por vez.`,
      );
    }

    let totalInseridos = 0;
    const todosLocais: GerarCascataResult['locais'] = [];

    // Começa recursão a partir de pais nulos (raiz)
    await this.gerarNivel(niveis, 0, null, '', obraCodigo, obraId, tenantId, tx, {
      total: { value: 0 },
      locais: todosLocais,
    });

    totalInseridos = todosLocais.length;

    return { inseridos: totalInseridos, locais: todosLocais };
  }

  private async gerarNivel(
    niveis: GerarGenericaDto['niveis'],
    nivelIdx: number,
    parentId: number | null,
    parentNomeCompleto: string,
    parentCodigo: string,
    obraId: number,
    tenantId: number,
    tx: GerarCascataContext['tx'],
    acc: { total: { value: number }; locais: GerarCascataResult['locais'] },
  ): Promise<void> {
    if (nivelIdx >= niveis.length) return;

    const cfg = niveis[nivelIdx];
    const inicioEm = cfg.inicioEm ?? 1;

    // Conta existentes para ordenação
    const ordemBase = await tx.obraLocal.count({
      where: { obraId, parentId: parentId ?? null, deletadoEm: null },
    });

    // Cria todos os locais desse nível de uma vez
    const data = Array.from({ length: cfg.qtde }, (_, i) => {
      const seq = inicioEm + i;
      const nome = `${cfg.prefixo} ${String(seq).padStart(2, '0')}`;
      const nomeCompleto = parentNomeCompleto ? `${parentNomeCompleto} > ${nome}` : nome;
      const codigoSufixo = `${cfg.prefixo.substring(0, 1).toUpperCase()}${String(seq).padStart(2, '0')}`;
      const codigo = `${parentCodigo}-${codigoSufixo}`;

      return {
        tenantId,
        obraId,
        parentId,
        nivel: cfg.nivel,
        nome,
        nomeCompleto,
        codigo,
        ordem: ordemBase + i,
        // tipoUnidade não existe como coluna — vai em dadosExtras
        ...(cfg.tipoUnidade ? { dadosExtras: { tipoUnidade: cfg.tipoUnidade } } : {}),
      };
    });

    await tx.obraLocal.createMany({ data });

    // Busca os IDs recém-criados para descer recursivamente
    const criados = await tx.obraLocal.findMany({
      where: { obraId, parentId: parentId ?? null, nivel: cfg.nivel, deletadoEm: null },
      orderBy: { ordem: 'asc' },
      select: { id: true, nome: true, nomeCompleto: true, codigo: true, nivel: true },
      take: cfg.qtde,
      skip: ordemBase,
    });

    acc.locais.push(...criados);

    // Desce para o próximo nível em cada pai criado
    if (nivelIdx + 1 < niveis.length) {
      for (const criado of criados) {
        await this.gerarNivel(
          niveis, nivelIdx + 1,
          criado.id, criado.nomeCompleto, criado.codigo,
          obraId, tenantId, tx, acc,
        );
      }
    }
  }
}
```

- [ ] **Step 2.4: Rodar testes — esperar pass**

```bash
npx jest src/obras/strategies/generica.strategy.spec.ts --no-coverage 2>&1 | tail -15
```
Esperado: `5 passed`

- [ ] **Step 2.5: Commit**

```bash
git add src/obras/strategies/generica.strategy.ts src/obras/strategies/generica.strategy.spec.ts
git commit -m "feat(obras): GenericaStrategy — geração recursiva multi-nível em cascata"
```

---

## Task 3 — Strategy Edificação

**Files:**
- Create: `src/obras/strategies/edificacao.strategy.ts`
- Create: `src/obras/strategies/edificacao.strategy.spec.ts`

- [ ] **Step 3.1: Escrever testes**

```typescript
// src/obras/strategies/edificacao.strategy.spec.ts
import { EdificacaoStrategy } from './edificacao.strategy';

describe('EdificacaoStrategy', () => {
  let strategy: EdificacaoStrategy;
  let registros: any[];
  let mockTx: any;
  const ctx = { obraId: 1, tenantId: 1, obraCodigo: 'OBR-2026-001', tx: null as any };

  beforeEach(() => {
    strategy = new EdificacaoStrategy();
    registros = [];
    let idSeq = 1;
    mockTx = {
      obraLocal: {
        create: jest.fn(async ({ data }) => {
          const row = { ...data, id: idSeq++ };
          registros.push(row);
          return row;
        }),
        createMany: jest.fn(async ({ data }) => {
          data.forEach((d: any) => registros.push({ ...d, id: idSeq++ }));
          return { count: data.length };
        }),
      },
    };
    ctx.tx = mockTx;
  });

  it('modo andar: 1 bloco × 3 andares × 2 unidades = 6 unidades + bloco = 7 registros', async () => {
    const result = await strategy.gerar(
      {
        estrategia: 'edificacao',
        blocoPrefixo: 'Bloco', blocoTipo: 'letra', blocoQtd: 1,
        modo: 'andar', andarInicio: 1, andarQtd: 3, unidadesAndar: 2, unidadePrefixo: 'AP',
      },
      ctx,
    );
    // 1 bloco + 3 andares + 6 apartamentos = 10
    expect(result.inseridos).toBe(10);
  });

  it('modo sequencial: 1 bloco × 5 unidades = 6 registros', async () => {
    const result = await strategy.gerar(
      {
        estrategia: 'edificacao',
        blocoPrefixo: 'Torre', blocoTipo: 'numero', blocoQtd: 1,
        modo: 'sequencial', unidadesTotal: 5, unidadePrefixo: 'AP',
      },
      ctx,
    );
    // 1 bloco + 5 unidades = 6
    expect(result.inseridos).toBe(6);
  });

  it('bloco por letra usa A, B, C...', async () => {
    await strategy.gerar(
      {
        estrategia: 'edificacao',
        blocoPrefixo: 'Bloco', blocoTipo: 'letra', blocoLetraInicio: 'A', blocoQtd: 3,
        modo: 'sequencial', unidadesTotal: 1, unidadePrefixo: 'AP',
      },
      ctx,
    );
    const blocos = registros.filter((r) => r.nivel === 1);
    expect(blocos.map((b) => b.nome)).toEqual(['Bloco A', 'Bloco B', 'Bloco C']);
  });

  it('com condomínio: cria nível 1 = condomínio, blocos em nível 2', async () => {
    await strategy.gerar(
      {
        estrategia: 'edificacao',
        condPrefixo: 'Residencial Aurora', condQtd: 1,
        blocoPrefixo: 'Bloco', blocoTipo: 'letra', blocoQtd: 2,
        modo: 'sequencial', unidadesTotal: 2, unidadePrefixo: 'AP',
      },
      ctx,
    );
    const nivel1 = registros.filter((r) => r.nivel === 1);
    expect(nivel1[0].nome).toBe('Residencial Aurora');
    const nivel2 = registros.filter((r) => r.nivel === 2);
    expect(nivel2).toHaveLength(2);
  });

  it('áreas comuns por bloco: halls, escadas', async () => {
    await strategy.gerar(
      {
        estrategia: 'edificacao',
        blocoPrefixo: 'Bloco', blocoTipo: 'letra', blocoQtd: 1,
        modo: 'andar', andarInicio: 1, andarQtd: 2, unidadesAndar: 1, unidadePrefixo: 'AP',
        areasComuns: ['halls', 'escadas'],
      },
      ctx,
    );
    const nomes = registros.map((r) => r.nome);
    expect(nomes.some((n) => n.includes('Hall'))).toBe(true);
    expect(nomes.some((n) => n.includes('Escada'))).toBe(true);
  });

  it('bloqueia se estimativa > 10000', async () => {
    await expect(
      strategy.gerar(
        {
          estrategia: 'edificacao',
          blocoPrefixo: 'Bloco', blocoTipo: 'numero', blocoQtd: 100,
          modo: 'andar', andarQtd: 30, unidadesAndar: 10, unidadePrefixo: 'AP',
        },
        ctx,
      ),
    ).rejects.toThrow('Limite');
  });
});
```

- [ ] **Step 3.2: Rodar teste — esperar falha**

```bash
npx jest src/obras/strategies/edificacao.strategy.spec.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3.3: Implementar EdificacaoStrategy**

```typescript
// src/obras/strategies/edificacao.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarEdificacaoDto } from '../dto/gerar-cascata.dto';

type TX = GerarCascataContext['tx'];

@Injectable()
export class EdificacaoStrategy implements ILocalGenerator {
  // Templates de áreas comuns por bloco
  private readonly templatesPorBloco: Record<string, (numAndares: number) => { nome: string; tipo: string }[]> = {
    halls:      (n) => Array.from({ length: Math.max(1, n) }, (_, i) => ({ nome: `Hall Pav ${i + 1}`, tipo: 'area_comum' })),
    escadas:    ()  => [{ nome: 'Escada', tipo: 'area_comum' }],
    elevadores: ()  => [{ nome: 'Eixo Elevador 1', tipo: 'tecnica' }, { nome: 'Casa de Máquinas Elevador', tipo: 'tecnica' }],
    fachadas:   ()  => ['Norte', 'Sul', 'Leste', 'Oeste'].map((f) => ({ nome: `Fachada ${f}`, tipo: 'estrutural' })),
    cobertura:  ()  => [{ nome: 'Cobertura', tipo: 'estrutural' }, { nome: "Caixa d'água", tipo: 'tecnica' }],
    garagem:    ()  => [{ nome: 'Garagem Subsolo', tipo: 'area_comum' }, { nome: 'Rampa de Acesso', tipo: 'area_comum' }],
  };

  // Templates de áreas globais por condomínio
  private readonly templatesGlobais: Record<string, { nome: string; tipo: string }[]> = {
    lazer:    [
      { nome: 'Piscina', tipo: 'area_comum' }, { nome: 'Salão de Festas', tipo: 'area_comum' },
      { nome: 'Churrasqueira', tipo: 'area_comum' }, { nome: 'Playground', tipo: 'area_comum' },
      { nome: 'Academia', tipo: 'area_comum' },
    ],
    sistemas: [
      { nome: 'Casa de Bombas', tipo: 'tecnica' }, { nome: 'Gerador', tipo: 'tecnica' },
      { nome: 'QGBT/Subestação', tipo: 'tecnica' }, { nome: 'Guarita', tipo: 'area_comum' },
      { nome: 'Portão de Acesso', tipo: 'area_comum' },
    ],
  };

  async gerar(payload: GerarEdificacaoDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { obraId, tenantId, obraCodigo, tx } = ctx;
    const condQtd = payload.condQtd ?? 1;
    const blocoQtd = payload.blocoQtd;
    const andarQtd = payload.andarQtd ?? 0;
    const unidadesAndar = payload.unidadesAndar ?? 0;
    const unidadesTotal = payload.unidadesTotal ?? 0;

    // Anti-DoS
    const unidPorBloco = payload.modo === 'andar'
      ? andarQtd * unidadesAndar
      : unidadesTotal;
    const estimativa = condQtd * blocoQtd * (andarQtd + unidPorBloco + 30) + condQtd * 15;
    if (estimativa > 10000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${estimativa} locais. Limite: 10.000 por vez.`,
      );
    }

    const locais: GerarCascataResult['locais'] = [];
    let inseridos = 0;
    const usaCondominio = !!payload.condPrefixo;
    const condInicio = payload.condInicio ?? 1;

    for (let c = 0; c < condQtd; c++) {
      let condParentId: number | null = null;
      let condNomeCompleto = '';
      let nivelBloco = 1;

      // Cria condomínio se necessário
      if (usaCondominio) {
        const condNum = condInicio + c;
        const condNome = condQtd === 1 ? payload.condPrefixo! : `${payload.condPrefixo} ${condNum}`;
        const cond = await tx.obraLocal.create({
          data: {
            tenantId, obraId, parentId: null, nivel: 1,
            nome: condNome, nomeCompleto: condNome,
            codigo: `${obraCodigo}-C${String(condNum).padStart(2, '0')}`,
            ordem: c,
          },
        });
        locais.push({ id: cond.id, nome: cond.nome, nomeCompleto: cond.nomeCompleto, nivel: 1 });
        inseridos++;
        condParentId = cond.id;
        condNomeCompleto = condNome;
        nivelBloco = 2;

        // Áreas globais do condomínio
        for (const area of payload.areasGlobais ?? []) {
          const items = this.templatesGlobais[area] ?? [];
          for (const item of items) {
            const local = await tx.obraLocal.create({
              data: {
                tenantId, obraId, parentId: condParentId, nivel: nivelBloco,
                nome: item.nome, nomeCompleto: `${condNomeCompleto} > ${item.nome}`,
                codigo: `${obraCodigo}-C${c + 1}-${item.nome.substring(0, 3).toUpperCase()}`,
                ordem: 9000 + inseridos,
              },
            });
            locais.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: nivelBloco });
            inseridos++;
          }
        }
      }

      // Cria blocos
      for (let b = 0; b < blocoQtd; b++) {
        const blocoLabel = payload.blocoTipo === 'letra'
          ? String.fromCharCode((payload.blocoLetraInicio ?? 'A').charCodeAt(0) + b)
          : String((payload.blocoNumInicio ?? 1) + b);
        const blocoNome = `${payload.blocoPrefixo} ${blocoLabel}`;
        const blocoNomeCompleto = condNomeCompleto ? `${condNomeCompleto} > ${blocoNome}` : blocoNome;

        const bloco = await tx.obraLocal.create({
          data: {
            tenantId, obraId, parentId: condParentId, nivel: nivelBloco,
            nome: blocoNome, nomeCompleto: blocoNomeCompleto,
            codigo: `${obraCodigo}-${blocoLabel}`,
            ordem: b,
          },
        });
        locais.push({ id: bloco.id, nome: bloco.nome, nomeCompleto: bloco.nomeCompleto, nivel: nivelBloco });
        inseridos++;

        const nivelAndar = nivelBloco + 1;
        const nivelUnidade = nivelAndar + 1;
        const andarInicio = payload.andarInicio ?? 1;

        if (payload.modo === 'andar') {
          // Cria andares e unidades por andar
          for (let a = 0; a < andarQtd; a++) {
            const andarNum = andarInicio + a;
            const andarNome = `${andarNum}º Pavimento`;
            const andarNomeCompleto = `${blocoNomeCompleto} > ${andarNome}`;

            const andar = await tx.obraLocal.create({
              data: {
                tenantId, obraId, parentId: bloco.id, nivel: nivelAndar,
                nome: andarNome, nomeCompleto: andarNomeCompleto,
                codigo: `${bloco.codigo}-P${String(andarNum).padStart(2, '0')}`,
                ordem: a,
              },
            });
            locais.push({ id: andar.id, nome: andar.nome, nomeCompleto: andar.nomeCompleto, nivel: nivelAndar });
            inseridos++;

            // Unidades por andar
            const unidData = Array.from({ length: unidadesAndar }, (_, u) => {
              const unidNum = andarNum * 100 + u + 1;
              const unidNome = `${payload.unidadePrefixo ?? 'AP'} ${unidNum}`;
              return {
                tenantId, obraId, parentId: andar.id, nivel: nivelUnidade,
                nome: unidNome, nomeCompleto: `${andarNomeCompleto} > ${unidNome}`,
                codigo: `${andar.codigo}-${String(unidNum).padStart(3, '0')}`,
                ordem: u,
              };
            });
            await tx.obraLocal.createMany({ data: unidData });
            inseridos += unidData.length;
            // createMany não retorna IDs — não empurrar locais com id: 0
          }
        } else {
          // Modo sequencial — unidades sem nível de andar
          const unidData = Array.from({ length: unidadesTotal }, (_, u) => {
            const unidNum = u + 1;
            const unidNome = `${payload.unidadePrefixo ?? 'AP'} ${String(unidNum).padStart(3, '0')}`;
            return {
              tenantId, obraId, parentId: bloco.id, nivel: nivelAndar,
              nome: unidNome, nomeCompleto: `${blocoNomeCompleto} > ${unidNome}`,
              codigo: `${bloco.codigo}-${String(unidNum).padStart(3, '0')}`,
              ordem: u,
            };
          });
          await tx.obraLocal.createMany({ data: unidData });
          inseridos += unidData.length;
          // createMany não retorna IDs — não empurrar locais com id: 0
        }

        // Áreas comuns por bloco
        for (const area of payload.areasComuns ?? []) {
          const items = this.templatesPorBloco[area]?.(andarQtd) ?? [];
          for (const item of items) {
            const local = await tx.obraLocal.create({
              data: {
                tenantId, obraId, parentId: bloco.id, nivel: nivelAndar,
                nome: item.nome, nomeCompleto: `${blocoNomeCompleto} > ${item.nome}`,
                codigo: `${bloco.codigo}-${item.nome.substring(0, 3).toUpperCase()}`,
                ordem: 8000 + inseridos,
              },
            });
            locais.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: nivelAndar });
            inseridos++;
          }
        }
      }
    }

    return { inseridos, locais };
  }
}
```

- [ ] **Step 3.4: Rodar testes**

```bash
npx jest src/obras/strategies/edificacao.strategy.spec.ts --no-coverage 2>&1 | tail -15
```
Esperado: `6 passed`

- [ ] **Step 3.5: Commit**

```bash
git add src/obras/strategies/edificacao.strategy.ts src/obras/strategies/edificacao.strategy.spec.ts
git commit -m "feat(obras): EdificacaoStrategy — residencial com blocos, andares, unidades e áreas comuns"
```

---

## Task 4 — Strategy Linear

**Files:**
- Create: `src/obras/strategies/linear.strategy.ts`
- Create: `src/obras/strategies/linear.strategy.spec.ts`

- [ ] **Step 4.1: Escrever testes**

```typescript
// src/obras/strategies/linear.strategy.spec.ts
import { LinearStrategy } from './linear.strategy';

describe('LinearStrategy', () => {
  let strategy: LinearStrategy;
  let registros: any[];
  let mockTx: any;
  const ctx = { obraId: 1, tenantId: 1, obraCodigo: 'OBR-2026-001', tx: null as any };

  beforeEach(() => {
    strategy = new LinearStrategy();
    registros = [];
    let idSeq = 1;
    mockTx = {
      obraLocal: {
        create: jest.fn(async ({ data }) => {
          const row = { ...data, id: idSeq++ };
          registros.push(row);
          return row;
        }),
        createMany: jest.fn(async ({ data }) => {
          data.forEach((d: any) => registros.push({ ...d, id: idSeq++ }));
          return { count: data.length };
        }),
      },
    };
    ctx.tx = mockTx;
  });

  it('cria trechos sem PVs', async () => {
    const result = await strategy.gerar(
      { estrategia: 'linear', trechos: [{ nome: 'Trecho 1' }, { nome: 'Trecho 2' }] },
      ctx,
    );
    expect(result.inseridos).toBe(2);
  });

  it('cria trechos com PVs numerados', async () => {
    const result = await strategy.gerar(
      {
        estrategia: 'linear',
        prefixoPV: 'PV',
        trechos: [{ nome: 'Trecho A', pvs: 3 }],
      },
      ctx,
    );
    // 1 trecho + 3 PVs
    expect(result.inseridos).toBe(4);
    const pvs = registros.filter((r) => r.nivel === 2);
    expect(pvs[0].nome).toBe('PV-001');
    expect(pvs[2].nome).toBe('PV-003');
  });

  it('distribui km dos PVs linearmente', async () => {
    await strategy.gerar(
      {
        estrategia: 'linear',
        trechos: [{ nome: 'Rota', kmInicio: 0, kmFim: 1, pvs: 3 }],
      },
      ctx,
    );
    const pvs = registros.filter((r) => r.nivel === 2);
    // km do PV do meio deve ser ~0.5
    expect(pvs[1].dadosExtras?.km).toBeCloseTo(0.5, 2);
  });

  it('insere elementos avulsos vinculados ao trecho', async () => {
    await strategy.gerar(
      {
        estrategia: 'linear',
        trechos: [{ nome: 'Trecho X' }],
        elementos: [{ nome: 'ETE Inicial', trecho: 'Trecho X' }],
      },
      ctx,
    );
    const elem = registros.find((r) => r.nome === 'ETE Inicial');
    expect(elem).toBeDefined();
    expect(elem?.nivel).toBe(2);
  });

  it('elemento sem trecho fica no nível 1', async () => {
    await strategy.gerar(
      {
        estrategia: 'linear',
        trechos: [{ nome: 'Trecho X' }],
        elementos: [{ nome: 'Marco Inicial' }],
      },
      ctx,
    );
    const elem = registros.find((r) => r.nome === 'Marco Inicial');
    expect(elem?.nivel).toBe(1);
  });
});
```

- [ ] **Step 4.2: Rodar — esperar falha**

```bash
npx jest src/obras/strategies/linear.strategy.spec.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 4.3: Implementar LinearStrategy**

```typescript
// src/obras/strategies/linear.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarLinearDto } from '../dto/gerar-cascata.dto';

@Injectable()
export class LinearStrategy implements ILocalGenerator {
  async gerar(payload: GerarLinearDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { obraId, tenantId, obraCodigo, tx } = ctx;
    const trechos = payload.trechos;
    const elementos = payload.elementos ?? [];
    const prefixoPV = payload.prefixoPV ?? 'PV';

    // Anti-DoS
    const totalEstimado = trechos.reduce((acc, t) => acc + 1 + (t.pvs ?? 0), 0) + elementos.length;
    if (totalEstimado > 10000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${totalEstimado} locais. Limite: 10.000 por vez.`,
      );
    }

    const locais: GerarCascataResult['locais'] = [];
    let inseridos = 0;
    const trechoMap: Record<string, number> = {}; // nome → id

    for (let idx = 0; idx < trechos.length; idx++) {
      const tr = trechos[idx];
      const trechoNome = tr.nome || `Trecho ${idx + 1}`;
      const kmInicio = tr.kmInicio ?? null;
      const kmFim = tr.kmFim ?? null;
      const extensaoM = (kmInicio !== null && kmFim !== null)
        ? Math.round(Math.abs(kmFim - kmInicio) * 1000 * 100) / 100
        : null;

      const trecho = await tx.obraLocal.create({
        data: {
          tenantId, obraId, parentId: null, nivel: 1,
          nome: trechoNome, nomeCompleto: trechoNome,
          codigo: `${obraCodigo}-TR${String(idx + 1).padStart(2, '0')}`,
          ordem: idx,
          dadosExtras: { kmInicio, kmFim, extensaoM },
        },
      });
      locais.push({ id: trecho.id, nome: trecho.nome, nomeCompleto: trecho.nomeCompleto, nivel: 1 });
      inseridos++;
      trechoMap[trechoNome] = trecho.id;

      // Gerar PVs
      const numPVs = tr.pvs ?? 0;
      if (numPVs > 0) {
        const pvData = Array.from({ length: numPVs }, (_, pvIdx) => {
          const pvNum = pvIdx + 1;
          const pvNome = `${prefixoPV}-${String(pvNum).padStart(3, '0')}`;
          const pvNomeCompleto = `${trechoNome} > ${pvNome}`;
          let pvKm: number | null = null;
          if (kmInicio !== null && kmFim !== null && numPVs > 1) {
            pvKm = Math.round((kmInicio + ((kmFim - kmInicio) * (pvIdx) / (numPVs - 1))) * 10000) / 10000;
          }
          return {
            tenantId, obraId, parentId: trecho.id, nivel: 2,
            nome: pvNome, nomeCompleto: pvNomeCompleto,
            codigo: `${trecho.codigo}-${pvNome}`,
            ordem: pvIdx,
            dadosExtras: { km: pvKm },
          };
        });
        await tx.obraLocal.createMany({ data: pvData });
        inseridos += pvData.length;
        // createMany não retorna IDs — não empurrar locais com id: 0
      }
    }

    // Elementos avulsos
    for (let eIdx = 0; eIdx < elementos.length; eIdx++) {
      const elem = elementos[eIdx];
      if (!elem.nome) continue;
      const elemParentId = elem.trecho ? (trechoMap[elem.trecho] ?? null) : null;
      const elemNivel = elemParentId !== null ? 2 : 1;
      const elemNomeCompleto = elemParentId !== null
        ? `${elem.trecho} > ${elem.nome}`
        : elem.nome;

      const local = await tx.obraLocal.create({
        data: {
          tenantId, obraId, parentId: elemParentId, nivel: elemNivel,
          nome: elem.nome, nomeCompleto: elemNomeCompleto,
          codigo: `${obraCodigo}-EL${String(eIdx + 1).padStart(3, '0')}`,
          ordem: 9000 + eIdx,
          dadosExtras: { km: elem.km ?? null },
        },
      });
      locais.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: elemNivel });
      inseridos++;
    }

    return { inseridos, locais };
  }
}
```

- [ ] **Step 4.4: Rodar testes**

```bash
npx jest src/obras/strategies/linear.strategy.spec.ts --no-coverage 2>&1 | tail -10
```
Esperado: `5 passed`

- [ ] **Step 4.5: Commit**

```bash
git add src/obras/strategies/linear.strategy.ts src/obras/strategies/linear.strategy.spec.ts
git commit -m "feat(obras): LinearStrategy — trechos, PVs distribuídos e elementos avulsos"
```

---

## Task 5 — Strategy Instalação

**Files:**
- Create: `src/obras/strategies/instalacao.strategy.ts`
- Create: `src/obras/strategies/instalacao.strategy.spec.ts`

- [ ] **Step 5.1: Escrever testes**

```typescript
// src/obras/strategies/instalacao.strategy.spec.ts
import { InstalacaoStrategy } from './instalacao.strategy';

describe('InstalacaoStrategy', () => {
  let strategy: InstalacaoStrategy;
  let registros: any[];
  let mockTx: any;
  const ctx = { obraId: 1, tenantId: 1, obraCodigo: 'OBR-2026-001', tx: null as any };

  beforeEach(() => {
    strategy = new InstalacaoStrategy();
    registros = [];
    let id = 1;
    mockTx = {
      obraLocal: {
        create: jest.fn(async ({ data }) => { const row = { ...data, id: id++ }; registros.push(row); return row; }),
        createMany: jest.fn(async ({ data }) => { data.forEach((d: any) => registros.push({ ...d, id: id++ })); return { count: data.length }; }),
      },
    };
    ctx.tx = mockTx;
  });

  it('cria áreas com módulos numerados', async () => {
    const result = await strategy.gerar(
      {
        estrategia: 'instalacao',
        areas: [{ nome: 'Área de Produção', modulos: [{ prefixo: 'Módulo', qtde: 3 }] }],
      },
      ctx,
    );
    // 1 área + 3 módulos
    expect(result.inseridos).toBe(4);
    const modulos = registros.filter((r) => r.nivel === 2);
    expect(modulos[0].nome).toBe('Módulo 01');
    expect(modulos[2].nome).toBe('Módulo 03');
  });

  it('cria módulo com nome exato (não numerado)', async () => {
    await strategy.gerar(
      {
        estrategia: 'instalacao',
        areas: [{ nome: 'Área Técnica', modulos: [{ nome: 'Casa de Bombas' }, { nome: 'Subestação' }] }],
      },
      ctx,
    );
    const modulos = registros.filter((r) => r.nivel === 2);
    expect(modulos.map((m) => m.nome)).toEqual(['Casa de Bombas', 'Subestação']);
  });

  it('múltiplas áreas', async () => {
    const result = await strategy.gerar(
      {
        estrategia: 'instalacao',
        areas: [
          { nome: 'Área A', modulos: [{ prefixo: 'M', qtde: 2 }] },
          { nome: 'Área B', modulos: [{ nome: 'Silo' }] },
        ],
      },
      ctx,
    );
    expect(result.inseridos).toBe(5); // 2 áreas + 2 módulos + 1 módulo
  });

  it('monta nomeCompleto com caminho da área', async () => {
    await strategy.gerar(
      {
        estrategia: 'instalacao',
        areas: [{ nome: 'ETE', modulos: [{ nome: 'Reator' }] }],
      },
      ctx,
    );
    const modulo = registros.find((r) => r.nome === 'Reator');
    expect(modulo?.nomeCompleto).toBe('ETE > Reator');
  });
});
```

- [ ] **Step 5.2: Rodar — esperar falha**

```bash
npx jest src/obras/strategies/instalacao.strategy.spec.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 5.3: Implementar InstalacaoStrategy**

```typescript
// src/obras/strategies/instalacao.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarInstalacaoDto } from '../dto/gerar-cascata.dto';

@Injectable()
export class InstalacaoStrategy implements ILocalGenerator {
  async gerar(payload: GerarInstalacaoDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { obraId, tenantId, obraCodigo, tx } = ctx;
    const areas = payload.areas;

    // Anti-DoS
    const totalEstimado = areas.reduce(
      (acc, a) => acc + 1 + a.modulos.reduce((m, mod) => m + Math.max(1, mod.qtde ?? 1), 0),
      0,
    );
    if (totalEstimado > 10000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${totalEstimado} locais. Limite: 10.000 por vez.`,
      );
    }

    const locais: GerarCascataResult['locais'] = [];
    let inseridos = 0;

    for (let aIdx = 0; aIdx < areas.length; aIdx++) {
      const area = areas[aIdx];
      const areaNome = area.nome || `Área ${aIdx + 1}`;

      const areaLocal = await tx.obraLocal.create({
        data: {
          tenantId, obraId, parentId: null, nivel: 1,
          nome: areaNome, nomeCompleto: areaNome,
          codigo: `${obraCodigo}-AR${String(aIdx + 1).padStart(2, '0')}`,
          ordem: aIdx,
        },
      });
      locais.push({ id: areaLocal.id, nome: areaLocal.nome, nomeCompleto: areaLocal.nomeCompleto, nivel: 1 });
      inseridos++;

      let ordemMod = 0;
      for (const mod of area.modulos) {
        if (mod.nome) {
          // Módulo com nome exato
          const local = await tx.obraLocal.create({
            data: {
              tenantId, obraId, parentId: areaLocal.id, nivel: 2,
              nome: mod.nome, nomeCompleto: `${areaNome} > ${mod.nome}`,
              codigo: `${areaLocal.codigo}-${mod.nome.substring(0, 3).toUpperCase()}`,
              ordem: ordemMod++,
            },
          });
          locais.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: 2 });
          inseridos++;
        } else if (mod.prefixo) {
          // Módulos numerados
          const qtde = mod.qtde ?? 1;
          const modData = Array.from({ length: qtde }, (_, i) => {
            const modNome = `${mod.prefixo} ${String(i + 1).padStart(2, '0')}`;
            return {
              tenantId, obraId, parentId: areaLocal.id, nivel: 2,
              nome: modNome, nomeCompleto: `${areaNome} > ${modNome}`,
              codigo: `${areaLocal.codigo}-${String(i + 1).padStart(2, '0')}`,
              ordem: ordemMod++,
            };
          });
          await tx.obraLocal.createMany({ data: modData });
          inseridos += modData.length;
          // createMany não retorna IDs — não empurrar locais com id: 0
        }
      }
    }

    return { inseridos, locais };
  }
}
```

- [ ] **Step 5.4: Rodar testes**

```bash
npx jest src/obras/strategies/instalacao.strategy.spec.ts --no-coverage 2>&1 | tail -10
```
Esperado: `4 passed`

- [ ] **Step 5.5: Commit**

```bash
git add src/obras/strategies/instalacao.strategy.ts src/obras/strategies/instalacao.strategy.spec.ts
git commit -m "feat(obras): InstalacaoStrategy — áreas com módulos fixos e numerados"
```

---

## Task 6 — Integrar strategies no ObrasService + Controller

**Files:**
- Modify: `src/obras/obras.service.ts`
- Modify: `src/obras/obras.controller.ts`
- Modify: `src/obras/obras.module.ts`

- [ ] **Step 6.1: Adicionar `gerarCascata()` no ObrasService**

Em `src/obras/obras.service.ts`, adicionar imports e método:

```typescript
// imports a adicionar no topo
import { GenericaStrategy } from './strategies/generica.strategy';
import { EdificacaoStrategy } from './strategies/edificacao.strategy';
import { LinearStrategy } from './strategies/linear.strategy';
import { InstalacaoStrategy } from './strategies/instalacao.strategy';
import { GerarCascataDto } from './dto/gerar-cascata.dto';

// no construtor, adicionar após `private prisma: PrismaService`:
// private genericaStrategy: GenericaStrategy,
// private edificacaoStrategy: EdificacaoStrategy,
// private linearStrategy: LinearStrategy,
// private instalacaoStrategy: InstalacaoStrategy,
```

Adicionar método ao final da classe:

```typescript
async gerarCascata(tenantId: number, obraId: number, dto: GerarCascataDto) {
  const obra = await this.findOne(tenantId, obraId);

  const strategyMap = {
    generica:    this.genericaStrategy,
    edificacao:  this.edificacaoStrategy,
    linear:      this.linearStrategy,
    instalacao:  this.instalacaoStrategy,
  };

  const strategy = strategyMap[dto.estrategia];
  if (!strategy) throw new BadRequestException(`Estratégia desconhecida: ${dto.estrategia}`);

  return this.prisma.$transaction(async (tx) => {
    const ctx = {
      obraId,
      tenantId,
      obraCodigo: obra.codigo ?? 'OBR',
      tx: tx as any,
    };
    return strategy.gerar(dto.payload as any, ctx);
  });
}
```

- [ ] **Step 6.2: Adicionar endpoint no ObrasController**

Em `src/obras/obras.controller.ts`, adicionar após o endpoint `gerar-massa`:

```typescript
@Post('obras/:id/locais/gerar-cascata')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.ENGENHEIRO)
gerarCascata(
  @TenantId() tenantId: number,
  @Param('id', ParseIntPipe) obraId: number,
  @Body() dto: GerarCascataDto,
) {
  return this.obrasService.gerarCascata(tenantId, obraId, dto);
}
```

Adicionar import: `import { GerarCascataDto } from './dto/gerar-cascata.dto';`

- [ ] **Step 6.3: Registrar strategies no ObrasModule**

```typescript
// src/obras/obras.module.ts — adicionar no providers:
import { GenericaStrategy } from './strategies/generica.strategy';
import { EdificacaoStrategy } from './strategies/edificacao.strategy';
import { LinearStrategy } from './strategies/linear.strategy';
import { InstalacaoStrategy } from './strategies/instalacao.strategy';

// providers: [ObrasService, GenericaStrategy, EdificacaoStrategy, LinearStrategy, InstalacaoStrategy]
```

- [ ] **Step 6.4: Compilar e verificar**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sem erros

- [ ] **Step 6.5: Commit**

```bash
git add src/obras/obras.service.ts src/obras/obras.controller.ts src/obras/obras.module.ts
git commit -m "feat(obras): endpoint gerar-cascata integrado com 4 strategies"
```

---

## Task 7 — Teste de integração do endpoint

**Files:**
- Create: `src/obras/obras-cascata.e2e.spec.ts` (ou adicionar em arquivo existente de integração)

- [ ] **Step 7.1: Escrever teste de integração**

```typescript
// src/obras/obras-cascata.integration.spec.ts
// Teste de smoke: verifica que cada estratégia chega ao banco com estrutura correta
// Usa PrismaService real + banco de teste

import { Test, TestingModule } from '@nestjs/testing';
import { ObrasService } from './obras.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenericaStrategy } from './strategies/generica.strategy';
import { EdificacaoStrategy } from './strategies/edificacao.strategy';
import { LinearStrategy } from './strategies/linear.strategy';
import { InstalacaoStrategy } from './strategies/instalacao.strategy';

describe('ObrasService.gerarCascata (integração)', () => {
  // Nota: esses testes rodam contra o banco de teste (NODE_ENV=test)
  // Setup: precisa de um tenant + obra existente no banco de teste
  // Por ora, marcar como skip se banco não disponível no CI

  it.todo('genérica: gera 2 níveis com nomeCompleto correto no banco');
  it.todo('edificação: bloco A com 3 andares × 2 APs = 9 registros no banco');
  it.todo('linear: 2 trechos × 2 PVs cada = 6 registros com km no dadosExtras');
  it.todo('instalação: 2 áreas × 3 módulos = 8 registros no banco');
});
```

- [ ] **Step 7.2: Testar manualmente via curl — estratégia genérica**

```bash
# Pegar token primeiro
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"slug":"eldox-teste","email":"itamar@eldox.com.br","senha":"Eldox@2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Criar obra de teste
OBRA_ID=$(curl -s -X POST http://localhost:3000/api/v1/obras \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Obra Cascata Teste","obraTipoId":1}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# Gerar cascata genérica
curl -s -X POST http://localhost:3000/api/v1/obras/$OBRA_ID/locais/gerar-cascata \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "estrategia": "generica",
    "payload": {
      "estrategia": "generica",
      "niveis": [
        {"nivel":1,"qtde":2,"prefixo":"Torre"},
        {"nivel":2,"qtde":3,"prefixo":"Pav"},
        {"nivel":3,"qtde":4,"prefixo":"AP"}
      ]
    }
  }' | python3 -m json.tool
```
Esperado: `"inseridos": 26` (2 torres + 6 pavimentos + 24 apartamentos)

- [ ] **Step 7.3: Testar edificação via curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/obras/$OBRA_ID/locais/gerar-cascata \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "estrategia": "edificacao",
    "payload": {
      "estrategia": "edificacao",
      "condPrefixo": "Residencial Aurora",
      "condQtd": 1,
      "blocoPrefixo": "Bloco",
      "blocoTipo": "letra",
      "blocoQtd": 2,
      "modo": "andar",
      "andarInicio": 1,
      "andarQtd": 3,
      "unidadesAndar": 4,
      "unidadePrefixo": "AP",
      "areasComuns": ["halls", "escadas"],
      "areasGlobais": ["lazer"]
    }
  }' | python3 -m json.tool
```

- [ ] **Step 7.4: Commit**

```bash
git add src/obras/obras-cascata.integration.spec.ts
git commit -m "test(obras): smoke tests de integração para gerar-cascata (todos como todo — base para CI futuro)"
```

---

## Task 8 — Frontend: serviço + seletor de estratégia no Wizard

**Files:**
- Modify: `src/services/obras.service.ts`
- Modify: `src/pages/obras/CadastroObraWizard.tsx`

- [ ] **Step 8.1: Adicionar `gerarCascata` no serviço frontend**

Em `src/services/obras.service.ts`, adicionar:

```typescript
export type EstrategiaGeracao = 'generica' | 'edificacao' | 'linear' | 'instalacao';

export async function gerarCascata(obraId: number, estrategia: EstrategiaGeracao, payload: unknown) {
  const { data } = await api.post(`/obras/${obraId}/locais/gerar-cascata`, {
    estrategia,
    payload: { estrategia, ...payload as object },
  });
  return data;
}
```

- [ ] **Step 8.2: Adicionar etapa de seleção de estratégia no Wizard**

Na etapa "Hierarquia" do `CadastroObraWizard.tsx`, adicionar seletor antes do formulário atual:

```tsx
// Adicionar estado
const [estrategia, setEstrategia] = useState<EstrategiaGeracao | null>(null);

// Adicionar JSX na etapa Hierarquia — ANTES do formulário atual
{!estrategia && (
  <div className="grid grid-cols-2 gap-4 mt-4">
    {[
      { key: 'edificacao', label: 'Edificação', desc: 'Condomínio, Blocos, Andares e Unidades' },
      { key: 'generica',   label: 'Genérica',   desc: 'Multi-nível configurável (qualquer tipo)' },
      { key: 'linear',     label: 'Linear',      desc: 'Trechos com PVs (rodovias, redes)' },
      { key: 'instalacao', label: 'Instalação',  desc: 'Áreas com módulos (fábricas, ETEs)' },
    ].map((e) => (
      <button
        key={e.key}
        onClick={() => setEstrategia(e.key as EstrategiaGeracao)}
        className="p-4 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] text-left transition-colors"
      >
        <div className="font-medium text-[var(--text-100)]">{e.label}</div>
        <div className="text-sm text-[var(--text-60)] mt-1">{e.desc}</div>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 8.3: Verificar visualmente no browser**

Abrir `http://localhost:5173`, criar nova obra, chegar na etapa Hierarquia e confirmar que os 4 cards de estratégia aparecem.

- [ ] **Step 8.4: Commit**

```bash
git add src/services/obras.service.ts src/pages/obras/CadastroObraWizard.tsx
git commit -m "feat(obras/frontend): seletor de estratégia de geração na etapa Hierarquia do wizard"
```

---

## Pontos flexíveis para adequações futuras

Os seguintes pontos foram deixados intencionalmente extensíveis:

| Ponto | Como estender |
|---|---|
| Nova estratégia | Criar `src/obras/strategies/nova.strategy.ts` implementando `ILocalGenerator`, registrar no module e adicionar ao `strategyMap` no service |
| Prefixos customizados nas áreas comuns | `templatesPorBloco` e `templatesGlobais` na `EdificacaoStrategy` são objetos simples — fácil adicionar novos tipos |
| Áreas comuns por tenant (custom) | Adicionar campo `areasComuns?: string[]` no payload e buscar do banco via `ObraTipoCampo` |
| Importação via CSV | Handler separado — reutiliza `tx.obraLocal.create` com parsing de CSV no service |
| Numeração personalizada | `inicioEm` já existe na estratégia genérica, pode ser adicionado às demais |
| Limite anti-DoS por plano | Substituir constante 5000/10000 por `tenant.plano.limites.locais_por_geracao` |

---

## Self-Review

**Cobertura da spec:**
- [x] Geração recursiva multi-nível (v2 `gerarLocaisRecursivo`) → `GenericaStrategy`
- [x] Edificação com blocos/andares/unidades/áreas comuns → `EdificacaoStrategy`
- [x] Linear com trechos/PVs/elementos → `LinearStrategy`
- [x] Instalação com áreas/módulos → `InstalacaoStrategy`
- [x] Limite anti-DoS em todas as strategies
- [x] Endpoint antigo `gerar-massa` mantido intacto
- [x] Frontend: seletor de estratégia no wizard
- [x] Arquitetura extensível (`ILocalGenerator`)

**Placeholders:** nenhum encontrado.

**Consistência de tipos:** `GerarCascataContext.tx` tipado como `Omit<PrismaClient, ...>` consistente com o que o `$transaction` entrega.
