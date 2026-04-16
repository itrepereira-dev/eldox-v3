// backend/src/planos-acao/pa/pa.service.spec.ts
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PaService } from './pa.service';

const TENANT_ID = 10;
const USER_ID = 99;

const CICLO = { id: 1, tenant_id: TENANT_ID, nome: 'Ciclo FVS', ativo: true };
const ETAPA_INICIAL = {
  id: 1, ciclo_id: 1, nome: 'Aberto', ordem: 0, cor: '#EF4444',
  is_inicial: true, is_final: false, roles_transicao: [],
};
const ETAPA_RESOLUCAO = {
  id: 2, ciclo_id: 1, nome: 'Em Resolução', ordem: 1, cor: '#F59E0B',
  is_inicial: false, is_final: false, roles_transicao: ['ENGENHEIRO', 'ADMIN_TENANT'],
};
const ETAPA_FINAL = {
  id: 3, ciclo_id: 1, nome: 'Fechado', ordem: 2, cor: '#10B981',
  is_inicial: false, is_final: true, roles_transicao: ['ENGENHEIRO', 'ADMIN_TENANT'],
};

const PA_ABERTO = {
  id: 1, tenant_id: TENANT_ID, ciclo_id: 1, etapa_atual_id: 1,
  numero: 'PA-2026-0001', titulo: 'Desvio estrutural',
  prioridade: 'ALTA', deleted_at: null, fechado_em: null,
  campos_extras: {},
  etapa_roles_transicao: [],
};

const PA_EM_RESOLUCAO = {
  ...PA_ABERTO, etapa_atual_id: 2,
  etapa_roles_transicao: ['ENGENHEIRO', 'ADMIN_TENANT'],
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): PaService {
  return new (PaService as any)(mockPrisma);
}

describe('PaService', () => {
  let svc: PaService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── gerarNumero ─────────────────────────────────────────────────────────────
  describe('gerarNumero (via createPa)', () => {
    it('gera PA-{ANO}-0001 quando não há PAs no tenant', async () => {
      const ano = new Date().getFullYear();
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([ETAPA_INICIAL])           // getEtapaInicialDoCiclo
        .mockResolvedValueOnce([{ total: '0' }])          // COUNT para gerarNumero
        .mockResolvedValueOnce([{ ...PA_ABERTO, numero: `PA-${ano}-0001` }]); // INSERT
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createPa(TENANT_ID, USER_ID, {
        cicloId: 1, obraId: 5, titulo: 'Desvio estrutural',
      });

      expect(result.numero).toBe(`PA-${ano}-0001`);
    });

    it('gera PA-{ANO}-0003 quando já existem 2 PAs', async () => {
      const ano = new Date().getFullYear();
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([ETAPA_INICIAL])
        .mockResolvedValueOnce([{ total: '2' }])
        .mockResolvedValueOnce([{ ...PA_ABERTO, numero: `PA-${ano}-0003` }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createPa(TENANT_ID, USER_ID, {
        cicloId: 1, obraId: 5, titulo: 'Desvio 2',
      });

      expect(result.numero).toBe(`PA-${ano}-0003`);
    });
  });

  // ── createPa — ciclo sem etapa inicial ─────────────────────────────────────
  describe('createPa()', () => {
    it('lança UnprocessableEntityException se ciclo não tem etapa inicial', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // sem etapa inicial

      await expect(
        svc.createPa(TENANT_ID, USER_ID, { cicloId: 1, obraId: 5, titulo: 'Teste' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  // ── transicionarEtapa ───────────────────────────────────────────────────────
  describe('transicionarEtapa()', () => {
    it('lança ForbiddenException se role não está em roles_transicao', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([PA_EM_RESOLUCAO]);

      await expect(
        svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'TECNICO', {
          etapaParaId: 3, comentario: 'ok',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança UnprocessableEntityException se etapa destino não pertence ao ciclo', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_EM_RESOLUCAO]) // getPaOuFalhar
        .mockResolvedValueOnce([]);               // etapa destino não encontrada no ciclo

      await expect(
        svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
          etapaParaId: 999,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lança UnprocessableEntityException se campo obrigatório ausente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_EM_RESOLUCAO])
        .mockResolvedValueOnce([ETAPA_FINAL])
        .mockResolvedValueOnce([{ id: 1, chave: 'evidencia_acao', obrigatorio: true, nome: 'Evidência' }]);

      await expect(
        svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
          etapaParaId: 3, camposExtras: {},
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('seta fechado_em quando etapa destino is_final=true', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_EM_RESOLUCAO])
        .mockResolvedValueOnce([ETAPA_FINAL])
        .mockResolvedValueOnce([]); // sem campos obrigatórios

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...PA_ABERTO, etapa_atual_id: 3, fechado_em: new Date() }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
        etapaParaId: 3,
      });

      expect(result.fechado_em).toBeTruthy();
    });

    it('avança etapa com sucesso quando role autorizado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_ABERTO])
        .mockResolvedValueOnce([ETAPA_RESOLUCAO])
        .mockResolvedValueOnce([]);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...PA_ABERTO, etapa_atual_id: 2 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
        etapaParaId: 2, comentario: 'Iniciando resolução',
      });

      expect(result.etapa_atual_id).toBe(2);
    });
  });

  // ── avaliarGatilhos ─────────────────────────────────────────────────────────
  describe('avaliarGatilhos()', () => {
    it('não abre PA se taxa acima do limiar', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 1, ciclo_id: 1, condicao: 'TAXA_CONFORMIDADE_ABAIXO', valor_limiar: 80, ativo: true },
      ]);
      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 42, {
        taxaConformidade: 85, obraId: 5,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('abre PA quando taxa abaixo do limiar e sem PA existente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 1, ciclo_id: 1, condicao: 'TAXA_CONFORMIDADE_ABAIXO', valor_limiar: 80, ativo: true },
        ])
        .mockResolvedValueOnce([]) // sem PA existente
        .mockResolvedValueOnce([ETAPA_INICIAL]) // getEtapaInicial
        .mockResolvedValueOnce([{ total: '0' }]) // gerarNumero
        .mockResolvedValueOnce([PA_ABERTO]); // INSERT
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 42, {
        taxaConformidade: 65, obraId: 5,
      });

      expect(createSpy).toHaveBeenCalledWith(
        TENANT_ID, 0,
        expect.objectContaining({ origemTipo: 'INSPECAO_FVS', origemId: 42 }),
      );
    });

    it('não abre PA duplicado quando já existe PA aberto para mesma origem', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 1, ciclo_id: 1, condicao: 'TAXA_CONFORMIDADE_ABAIXO', valor_limiar: 80, ativo: true },
        ])
        .mockResolvedValueOnce([{ id: 99 }]); // PA existente

      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 42, {
        taxaConformidade: 65, obraId: 5,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('abre PA quando temItemCriticoNc=true e gatilho ITEM_CRITICO_NC ativo', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 2, ciclo_id: 1, condicao: 'ITEM_CRITICO_NC', criticidade_min: 'critico', ativo: true },
        ])
        .mockResolvedValueOnce([]) // sem PA existente
        .mockResolvedValueOnce([ETAPA_INICIAL])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([PA_ABERTO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 10, {
        temItemCriticoNc: true, obraId: 5,
      });

      expect(createSpy).toHaveBeenCalled();
    });
  });

  // ── deletePa ─────────────────────────────────────────────────────────────────
  describe('deletePa()', () => {
    it('lança NotFoundException para PA inexistente', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(svc.deletePa(TENANT_ID, 9999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('executa soft delete no PA existente', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([PA_ABERTO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.deletePa(TENANT_ID, 1);

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = NOW()'),
        1, TENANT_ID,
      );
    });
  });
});
