// backend/src/fvs/inspecao/inspecao.service.spec.ts
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InspecaoService } from './inspecao.service';

const TENANT_ID = 5;
const USER_ID = 42;

const FICHA_RASCUNHO = {
  id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Torre 1',
  regime: 'pbqph', status: 'rascunho', criado_por: USER_ID,
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
};

const FICHA_EM_INSPECAO = { ...FICHA_RASCUNHO, status: 'em_inspecao' };

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

const mockGed = {
  upload: jest.fn(),
};

function makeService(): InspecaoService {
  return new (InspecaoService as any)(mockPrisma, mockGed);
}

describe('InspecaoService', () => {
  let svc: InspecaoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── createFicha ─────────────────────────────────────────────────────────────
  describe('createFicha()', () => {
    it('cria ficha com rascunho e grava audit_log quando regime=pbqph', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_RASCUNHO])       // INSERT fvs_fichas
        .mockResolvedValueOnce([{ id: 10 }])            // INSERT fvs_ficha_servicos
        .mockResolvedValueOnce([{ id: 20 }]);           // INSERT fvs_ficha_servico_locais
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const dto = {
        obraId: 10, nome: 'FVS Torre 1', regime: 'pbqph' as const,
        servicos: [{ servicoId: 1, localIds: [1], itensExcluidos: undefined }],
      };
      const result = await svc.createFicha(TENANT_ID, USER_ID, dto, '127.0.0.1');

      expect(result.status).toBe('rascunho');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        TENANT_ID,          // $1 tenant_id
        expect.anything(),  // $2 ficha_id
        null,               // $3 registro_id (nullable)
        'abertura_ficha',   // $4 acao
        null,               // $5 status_de (nullable)
        null,               // $6 status_para (nullable)
        USER_ID,            // $7 usuario_id
        '127.0.0.1',        // $8 ip
        null,               // $9 detalhes (nullable)
      );
    });

    it('NÃO grava audit_log quando regime=livre', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_RASCUNHO, regime: 'livre' }])
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }]);

      await svc.createFicha(TENANT_ID, USER_ID, {
        obraId: 10, nome: 'FVS Torre 1', regime: 'livre',
        servicos: [{ servicoId: 1, localIds: [1] }],
      }, '127.0.0.1');

      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  // ── patchFicha ──────────────────────────────────────────────────────────────
  describe('patchFicha()', () => {
    it('lança NotFoundException se ficha não existe no tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.patchFicha(TENANT_ID, 999, USER_ID, { status: 'em_inspecao' }, '127.0.0.1'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('transição rascunho→em_inspecao válida', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_RASCUNHO])             // buscar ficha
        .mockResolvedValueOnce([FICHA_EM_INSPECAO]);         // UPDATE retorno
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'em_inspecao' }, '127.0.0.1');
      expect(result.status).toBe('em_inspecao');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        TENANT_ID,
        1,              // fichaId
        null,           // registroId
        'alteracao_status',
        'rascunho',     // statusDe
        'em_inspecao',  // statusPara
        USER_ID,
        '127.0.0.1',    // ip
        null,           // detalhes
      );
    });

    it('transição inválida rascunho→concluida lança ConflictException', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_RASCUNHO]);
      await expect(
        svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── deleteFicha ─────────────────────────────────────────────────────────────
  describe('deleteFicha()', () => {
    it('retorna 409 se status ≠ rascunho', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_EM_INSPECAO]);
      await expect(svc.deleteFicha(TENANT_ID, 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('soft-delete com sucesso quando status=rascunho', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_RASCUNHO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      await expect(svc.deleteFicha(TENANT_ID, 1)).resolves.toBeUndefined();
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at'),
        1, TENANT_ID,
      );
    });
  });

  // ── getGrade ────────────────────────────────────────────────────────────────
  describe('getGrade()', () => {
    it('retorna grade com células agregadas por 4 estados', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])   // getFichaOuFalhar
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }, { id: 11, nome: 'Ap 102', pavimento_id: 1 }])
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 10, status: 'nao_conforme' },
          { servico_id: 1, obra_local_id: 11, status: 'conforme' },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('nc');
      expect(result.celulas[1][11]).toBe('aprovado');
    });

    it('célula sem registros = nao_avaliado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        .mockResolvedValueOnce([]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('nao_avaliado');
    });

    it('mix de conforme e nao_avaliado (sem NC) = pendente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 10, status: 'conforme' },
          { servico_id: 1, obra_local_id: 10, status: 'nao_avaliado' },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('pendente');
    });

    it('excecao alone = aprovado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        .mockResolvedValueOnce([{ servico_id: 1, obra_local_id: 10, status: 'excecao' }]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('aprovado');
    });

    it('NC mixed com conforme → nc vence (prioridade NC)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 10, status: 'conforme' },
          { servico_id: 1, obra_local_id: 10, status: 'nao_conforme' },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('nc');
    });

    it('lança NotFoundException se ficha não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.getGrade(TENANT_ID, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── putRegistro ──────────────────────────────────────────────────────────────
  describe('putRegistro()', () => {
    it('retorna 409 se ficha não está em_inspecao', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_RASCUNHO]);
      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'conforme' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('regime=pbqph, status=nao_conforme sem observacao → 422', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_EM_INSPECAO]);
      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('regime=pbqph, status=nao_conforme COM observacao → salva e grava audit_log', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])             // getFichaOuFalhar
        .mockResolvedValueOnce([{ criticidade: 'critico' }])    // buscar item
        .mockResolvedValueOnce([{ id: 5, status: 'nao_conforme' }]); // upsert retorno
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme', observacao: 'Desvio observado',
      }, '127.0.0.1');

      expect(result.status).toBe('nao_conforme');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        TENANT_ID,          // $1 tenant_id
        1,                  // $2 ficha_id
        5,                  // $3 registro_id (from mock return { id: 5 })
        'inspecao',         // $4 acao
        null,               // $5 status_de (not provided → null)
        'nao_conforme',     // $6 status_para
        USER_ID,            // $7 usuario_id
        '127.0.0.1',        // $8 ip_origem
        expect.stringContaining('"itemId"'), // $9 detalhes JSON
      );
    });

    it('regime=livre, status=nao_conforme sem observacao → salva sem audit_log', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
        .mockResolvedValueOnce([{ criticidade: 'menor' }])
        .mockResolvedValueOnce([{ id: 5, status: 'nao_conforme' }]);

      const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme',
      }, '127.0.0.1');

      expect(result.status).toBe('nao_conforme');
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  // ── deleteEvidencia ──────────────────────────────────────────────────────────
  describe('deleteEvidencia()', () => {
    it('remove evidência e grava audit_log (pbqph)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1, tenant_id: TENANT_ID, registro_id: 5, ged_versao_id: 99, ficha_id: 1 }]) // buscar evidencia
        .mockResolvedValueOnce([FICHA_EM_INSPECAO]); // getFichaOuFalhar
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.deleteEvidencia(TENANT_ID, 1, USER_ID, '127.0.0.1');

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2); // DELETE + audit_log
    });

    it('lança NotFoundException se evidência não pertence ao tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.deleteEvidencia(TENANT_ID, 999, USER_ID, '127.0.0.1'))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── patchLocal ───────────────────────────────────────────────────────────────
  describe('patchLocal()', () => {
    it('lança ConflictException se ficha está concluída', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...FICHA_RASCUNHO, status: 'concluida' }]);
      await expect(svc.patchLocal(TENANT_ID, 1, 1, { equipeResponsavel: 'Equipe A' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('atualiza equipe_responsavel com sucesso', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])          // getFichaOuFalhar
        .mockResolvedValueOnce([{ id: 1, equipe_responsavel: 'Equipe A' }]); // UPDATE retorno
      const result = await svc.patchLocal(TENANT_ID, 1, 1, { equipeResponsavel: 'Equipe A' });
      expect(result.equipe_responsavel).toBe('Equipe A');
    });
  });
});
