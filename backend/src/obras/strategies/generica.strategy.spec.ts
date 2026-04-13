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
