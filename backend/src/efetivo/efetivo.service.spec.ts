// backend/src/efetivo/efetivo.service.spec.ts
import {
  BadRequestException, ConflictException,
  ForbiddenException, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { EfetivoService } from './efetivo.service';

const TENANT_ID = 5;
const USER_ID   = 42;
const OBRA_ID   = 10;
const IP        = '127.0.0.1';
const HOJE      = new Date().toISOString().split('T')[0];
const AMANHA    = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const EMPRESA   = { id: 1, tenant_id: TENANT_ID, nome: 'Construmax', ativa: true };
const FUNCAO    = { id: 1, tenant_id: TENANT_ID, nome: 'Pedreiro',   ativa: true };
const REGISTRO: any  = {
  id: 1, tenant_id: TENANT_ID, obra_id: OBRA_ID,
  data: HOJE, turno: 'INTEGRAL', fechado: false,
  fechado_por: null, fechado_em: null, criado_por: USER_ID,
  criado_em: new Date(), atualizado_em: new Date(), rdo_id: null,
};
const ITEM: any = {
  id: 1, tenant_id: TENANT_ID, registro_efetivo_id: 1,
  empresa_id: 1, funcao_id: 1, quantidade: 8, observacao: null,
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): EfetivoService {
  return new (EfetivoService as any)(mockPrisma);
}

describe('EfetivoService', () => {
  let svc: EfetivoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  describe('createRegistro()', () => {
    it('lança UnprocessableEntityException se data é futura', async () => {
      await expect(svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: AMANHA, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lança BadRequestException se obra não pertence ao tenant', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: HOJE, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cria registro com itens e retorna objeto completo', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: OBRA_ID }])
        .mockResolvedValueOnce([EMPRESA])
        .mockResolvedValueOnce([FUNCAO])
        .mockResolvedValueOnce([REGISTRO])
        .mockResolvedValueOnce([ITEM])
        .mockResolvedValueOnce([]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: HOJE, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP);

      expect(result.id).toBe(1);
      expect(result.itens).toHaveLength(1);
      expect(result.rdo_id).toBeNull();
    });

    it('lança ConflictException em duplicata obra+data+turno', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: OBRA_ID }])
        .mockResolvedValueOnce([EMPRESA])
        .mockResolvedValueOnce([FUNCAO])
        .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));

      await expect(svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: HOJE, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('fecharRegistro()', () => {
    it('lança ForbiddenException se registro já fechado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...REGISTRO, fechado: true }]);
      await expect(svc.fecharRegistro(TENANT_ID, OBRA_ID, 1, USER_ID, IP))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança UnprocessableEntityException se registro não tem itens', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([REGISTRO])
        .mockResolvedValueOnce([{ count: '0' }]);
      await expect(svc.fecharRegistro(TENANT_ID, OBRA_ID, 1, USER_ID, IP))
        .rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('fecha registro e grava audit_log', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([REGISTRO])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ ...REGISTRO, fechado: true }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.fecharRegistro(TENANT_ID, OBRA_ID, 1, USER_ID, IP);
      expect(result.fechado).toBe(true);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO efetivo_audit_log'),
        TENANT_ID, 1, 'fechamento', USER_ID, IP, null,
      );
    });
  });

  describe('reabrirRegistro()', () => {
    it('reabre registro fechado e grava audit_log', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...REGISTRO, fechado: true }])
        .mockResolvedValueOnce([REGISTRO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.reabrirRegistro(TENANT_ID, OBRA_ID, 1, USER_ID, IP);
      expect(result.fechado).toBe(false);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO efetivo_audit_log'),
        TENANT_ID, 1, 'reabertura', USER_ID, IP, null,
      );
    });
  });

  describe('patchItem()', () => {
    it('lança ForbiddenException se registro fechado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...REGISTRO, fechado: true }]);
      await expect(svc.patchItem(TENANT_ID, OBRA_ID, 1, 1, { quantidade: 5 }, USER_ID, IP))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
