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
