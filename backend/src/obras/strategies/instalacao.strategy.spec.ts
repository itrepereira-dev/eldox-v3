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
