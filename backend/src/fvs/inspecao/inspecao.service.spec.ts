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

function makeService(): InspecaoService {
  return new (InspecaoService as any)(mockPrisma);
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
});
