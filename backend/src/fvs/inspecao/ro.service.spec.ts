// backend/src/fvs/inspecao/ro.service.spec.ts
import { NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { RoService } from './ro.service';

const TENANT_ID = 5;
const USER_ID = 42;

const FICHA_CONCLUIDA = {
  id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Torre 1',
  regime: 'pbqph', status: 'concluida', criado_por: USER_ID,
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
};

const RO_ABERTO = {
  id: 1, tenant_id: TENANT_ID, ficha_id: 1, numero: 'RO-1-1',
  ciclo_numero: 1,
  tipo: 'real', responsavel_id: USER_ID, data_ocorrencia: '2026-04-09',
  o_que_aconteceu: null, acao_imediata: null, causa_6m: null,
  justificativa_causa: null, status: 'aberto',
  created_at: new Date(), updated_at: new Date(),
};

const SERVICO_NC_PENDENTE = {
  id: 1, tenant_id: TENANT_ID, ro_id: 1, servico_id: 10,
  servico_nome: 'Alvenaria', acao_corretiva: null,
  status: 'pendente', ciclo_reinspecao: null,
  desbloqueado_em: null, verificado_em: null, created_at: new Date(),
};

const SERVICO_NC_DESBLOQUEADO = { ...SERVICO_NC_PENDENTE, status: 'desbloqueado', ciclo_reinspecao: 2 };

const ITEM_NC = {
  id: 1, tenant_id: TENANT_ID, ro_servico_nc_id: 1,
  registro_id: 10, item_descricao: 'Espessura da argamassa', item_criticidade: 'maior',
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

const mockGed = { upload: jest.fn() };

function makeService(): RoService {
  return new (RoService as any)(mockPrisma, mockGed);
}

describe('RoService', () => {
  let svc: RoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── getRo ─────────────────────────────────────────────────────────────────────
  describe('getRo()', () => {
    it('retorna RO completo com servicos e itens', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE])
        .mockResolvedValueOnce([ITEM_NC])     // itens do serviço 1
        .mockResolvedValueOnce([]);           // evidencias do serviço 1

      const result = await svc.getRo(TENANT_ID, 1);
      expect(result.id).toBe(1);
      expect(result.servicos).toHaveLength(1);
      expect(result.servicos![0].itens).toHaveLength(1);
    });

    it('lança NotFoundException se RO não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.getRo(TENANT_ID, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── patchRo ───────────────────────────────────────────────────────────────────
  describe('patchRo()', () => {
    it('atualiza campos do cabeçalho do RO', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])   // buscar RO
        .mockResolvedValueOnce([{ ...RO_ABERTO, tipo: 'potencial' }]); // UPDATE
      const result = await svc.patchRo(TENANT_ID, 1, { tipo: 'potencial' });
      expect(result.tipo).toBe('potencial');
    });

    it('lança NotFoundException se RO não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.patchRo(TENANT_ID, 999, {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── patchServicoNc ────────────────────────────────────────────────────────────
  describe('patchServicoNc()', () => {
    it('atualiza acao_corretiva sem desbloquear', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE])
        .mockResolvedValueOnce([{ ...SERVICO_NC_PENDENTE, acao_corretiva: 'Refazer argamassa' }]);

      const result = await svc.patchServicoNc(TENANT_ID, 1, 1, { acao_corretiva: 'Refazer argamassa' });
      expect(result.acao_corretiva).toBe('Refazer argamassa');
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('desbloquear com regime=pbqph sem campos obrigatórios → 422', async () => {
      const fichaRo = { ...RO_ABERTO };
      const fichaBase = { ...FICHA_CONCLUIDA };
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaRo])            // buscar RO
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE]) // buscar serviço
        .mockResolvedValueOnce([{ exige_reinspecao: true }]) // Sprint 4a: guard exige_reinspecao
        .mockResolvedValueOnce([fichaBase]);          // buscar ficha (para regime)

      await expect(
        svc.patchServicoNc(TENANT_ID, 1, 1, { desbloquear: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('desbloquear serviço com campos preenchidos → cria fvs_registros ciclo=2', async () => {
      const roPreenchido = {
        ...RO_ABERTO,
        responsavel_id: USER_ID,
        causa_6m: 'material',
        tipo: 'real',
      };
      const fichaBase = { ...FICHA_CONCLUIDA };
      const itenNc = [{ id: 1, registro_id: 10, item_id: 5 }];
      const registroOriginal = {
        id: 10, tenant_id: TENANT_ID, ficha_id: 1, servico_id: 10, item_id: 5,
        obra_local_id: 20, status: 'nao_conforme', ciclo: 1,
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([roPreenchido])        // buscar RO
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE]) // buscar serviço
        .mockResolvedValueOnce([{ exige_reinspecao: true }]) // Sprint 4a: guard exige_reinspecao
        .mockResolvedValueOnce([fichaBase])           // buscar ficha
        .mockResolvedValueOnce([itenNc[0]])           // buscar itens NC
        .mockResolvedValueOnce([registroOriginal])    // buscar registro original
        .mockResolvedValueOnce([{ ...SERVICO_NC_DESBLOQUEADO }]); // UPDATE servico_nc

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // INSERT fvs_registros + audit_log

      const result = await svc.patchServicoNc(TENANT_ID, 1, 1, { desbloquear: true });
      expect(result.status).toBe('desbloqueado');
      // INSERT INTO fvs_registros (ciclo=2) foi chamado
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_registros'),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), 2, // ciclo=2
        'nao_avaliado', null, // userId não fornecido → null
      );
    });

    it('lança UnprocessableEntityException ao desbloquear quando exige_reinspecao=false', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])                      // ro_ocorrencias WHERE ficha_id
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE])            // ro_servicos_nc WHERE id
        .mockResolvedValueOnce([{ exige_reinspecao: false }]);   // fvs_fichas WHERE id (nova query Sprint 4a)
      await expect(
        svc.patchServicoNc(TENANT_ID, RO_ABERTO.ficha_id, SERVICO_NC_PENDENTE.id, { desbloquear: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lança ConflictException se serviço já está verificado', async () => {
      const roComVerificado = { ...RO_ABERTO };
      const servicoVerificado = { ...SERVICO_NC_PENDENTE, status: 'verificado' };
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([roComVerificado])
        .mockResolvedValueOnce([servicoVerificado]);

      await expect(
        svc.patchServicoNc(TENANT_ID, 1, 1, { acao_corretiva: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── checkAndAdvanceRoStatus ───────────────────────────────────────────────────
  describe('checkAndAdvanceRoStatus()', () => {
    it('marca serviço verificado quando todos NC do ciclo são conformes', async () => {
      const roComServico = { ...RO_ABERTO };
      // Serviço desbloqueado com 1 item NC — ciclo=2 conforme
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([roComServico])                  // buscar RO da ficha
        .mockResolvedValueOnce([SERVICO_NC_DESBLOQUEADO])       // servicos desbloqueados
        .mockResolvedValueOnce([{ pendente_count: '0' }])       // itens NC ainda pendentes = 0
        .mockResolvedValueOnce([{ pendente_count: '1' }]);      // ainda tem outros pendentes → não conclui RO

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.checkAndAdvanceRoStatus(TENANT_ID, 1);

      // Deve marcar serviço como verificado
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'verificado'"),
        expect.anything(), // servicoNcId
        expect.anything(), // tenantId
      );
    });

    it('marca RO concluido quando todos servicos estao verificados', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...RO_ABERTO }])
        .mockResolvedValueOnce([SERVICO_NC_DESBLOQUEADO])
        .mockResolvedValueOnce([{ pendente_count: '0' }])    // serviço 1 ficou verificado
        .mockResolvedValueOnce([{ pendente_count: '0' }]);   // todos servicos verificados (nenhum pendente/desbloqueado)

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.checkAndAdvanceRoStatus(TENANT_ID, 1);

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'concluido'"),
        expect.anything(), // roId
        expect.anything(), // tenantId
      );
    });

    it('não faz nada se RO não existe para a ficha', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // sem RO
      await svc.checkAndAdvanceRoStatus(TENANT_ID, 1);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });
});
