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
