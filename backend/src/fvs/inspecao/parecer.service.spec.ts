// backend/src/fvs/inspecao/parecer.service.spec.ts
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ParecerService } from './parecer.service';

const TENANT_ID = 5;
const USER_ID = 42;

const FICHA_CONCLUIDA = {
  id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Torre 1',
  regime: 'pbqph', status: 'concluida', criado_por: USER_ID,
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
  exige_parecer: true,
};

const FICHA_AGUARDANDO = { ...FICHA_CONCLUIDA, status: 'aguardando_parecer' };
const FICHA_LIVRE_CONCLUIDA = { ...FICHA_CONCLUIDA, regime: 'livre' };

const RO_CONCLUIDO = {
  id: 1, tenant_id: TENANT_ID, ficha_id: 1, numero: 'RO-1-1',
  tipo: 'real', responsavel_id: USER_ID, data_ocorrencia: '2026-04-09',
  status: 'concluido', created_at: new Date(), updated_at: new Date(),
};

const RO_ABERTO = { ...RO_CONCLUIDO, status: 'aberto' };

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): ParecerService {
  return new (ParecerService as any)(mockPrisma);
}

describe('ParecerService', () => {
  let svc: ParecerService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── solicitarParecer ─────────────────────────────────────────────────────────
  describe('solicitarParecer()', () => {
    it('transita concluida → aguardando_parecer quando sem RO', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_CONCLUIDA])  // getFicha
        .mockResolvedValueOnce([])                  // sem RO
        .mockResolvedValueOnce([FICHA_AGUARDANDO]); // UPDATE
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.solicitarParecer(TENANT_ID, 1, USER_ID, '127.0.0.1');
      expect(result.status).toBe('aguardando_parecer');
    });

    it('transita quando RO existe e está concluido', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_CONCLUIDA])  // getFicha
        .mockResolvedValueOnce([RO_CONCLUIDO])     // RO concluido
        .mockResolvedValueOnce([FICHA_AGUARDANDO]); // UPDATE
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.solicitarParecer(TENANT_ID, 1, USER_ID, '127.0.0.1');
      expect(result.status).toBe('aguardando_parecer');
    });

    it('retorna 409 quando RO existe e está aberto', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_CONCLUIDA])
        .mockResolvedValueOnce([RO_ABERTO]);

      await expect(svc.solicitarParecer(TENANT_ID, 1, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    });

    it('retorna 409 quando ficha não está concluida', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...FICHA_CONCLUIDA, status: 'em_inspecao' }]);
      await expect(svc.solicitarParecer(TENANT_ID, 1, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── submitParecer ────────────────────────────────────────────────────────────
  describe('submitParecer()', () => {
    it('aprovado: FVS → aprovada', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_AGUARDANDO])
        .mockResolvedValueOnce([{ id: 99 }])        // INSERT parecer
        .mockResolvedValueOnce([{ ...FICHA_AGUARDANDO, status: 'aprovada' }]); // UPDATE ficha
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'aprovado' }, '127.0.0.1');
      expect(result.status).toBe('aprovada');
    });

    it('rejeitado (livre): FVS → em_inspecao, cria registros ciclo+1', async () => {
      const fichaLivre = { ...FICHA_LIVRE_CONCLUIDA, status: 'aguardando_parecer' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaLivre])
        .mockResolvedValueOnce([{ id: 99 }])   // INSERT parecer
        .mockResolvedValueOnce([{ max_ciclo: '1' }])  // MAX ciclo
        .mockResolvedValueOnce([{ id: 5, item_id: 1, servico_id: 10, obra_local_id: 20 }]) // itens NC ciclo atual
        .mockResolvedValueOnce([{ ...fichaLivre, status: 'em_inspecao' }]); // UPDATE ficha
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // INSERT registros ciclo+1

      const result = await svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'rejeitado', observacao: 'Pendências encontradas' });
      expect(result.status).toBe('em_inspecao');
    });

    it('rejeitado PBQP-H sem observacao → 422', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_AGUARDANDO]);
      await expect(
        svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'rejeitado' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('retorna 409 se ficha não está aguardando_parecer', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_CONCLUIDA]);
      await expect(
        svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'aprovado' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
