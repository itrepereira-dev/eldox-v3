// backend/src/concretagem/concretagens/concretagens.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { ConcrtagensService } from './concretagens.service';

const TENANT_ID = 10;
const OBRA_ID   = 5;
const USER_ID   = 42;

const mockConcretagem: Record<string, unknown> = {
  id: 1,
  tenant_id: TENANT_ID,
  obra_id: OBRA_ID,
  numero: 'CONC-5-0001',
  elemento_estrutural: 'Pilar P1',
  obra_local_id: null,
  volume_previsto: 10,
  traco_especificado: null,
  fck_especificado: 25,
  fornecedor_id: 2,
  data_programada: '2026-04-15',
  hora_programada: null,
  status: 'PROGRAMADA',
  responsavel_id: null,
  observacoes: null,
  criado_por: USER_ID,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockCaminhao = { id: 1, sequencia: 1, status: 'CHEGOU' };
const mockCp       = { id: 1, numero: 'CP-1-1-001', idade_dias: 28 };

const prismaMock = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): ConcrtagensService {
  return new (ConcrtagensService as any)(prismaMock);
}

describe('ConcrtagensService', () => {
  let svc: ConcrtagensService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── gerarNumero ─────────────────────────────────────────────────────────

  describe('gerarNumero()', () => {
    it('retorna CONC-{obraId}-0001 quando não há concretagens anteriores', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 0 }]);
      const result = await svc.gerarNumero(TENANT_ID, OBRA_ID);
      expect(result).toBe(`CONC-${OBRA_ID}-0001`);
    });

    it('retorna sequência com zero-padding de 4 dígitos', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 9 }]);
      const result = await svc.gerarNumero(TENANT_ID, OBRA_ID);
      expect(result).toBe(`CONC-${OBRA_ID}-0010`);
    });
  });

  // ── criar ───────────────────────────────────────────────────────────────

  describe('criar()', () => {
    const dto = {
      elemento_estrutural: 'Pilar P1',
      volume_previsto: 10,
      fck_especificado: 25,
      fornecedor_id: 2,
      data_programada: '2026-04-15',
    };

    it('cria concretagem e retorna objeto completo com caminhões e CPs', async () => {
      // validarObra
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: OBRA_ID }]);
      // gerarNumero → COUNT
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 0 }]);
      // INSERT concretagem → RETURNING id
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: 1 }]);
      // buscar → concretagem row
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockConcretagem]);
      // buscar → caminhoes
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCaminhao]);
      // buscar → cps
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCp]);
      // auditLog (fire-and-forget)
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);

      const result = await svc.criar(TENANT_ID, OBRA_ID, USER_ID, dto as any);

      expect(result).toMatchObject({ id: 1, numero: 'CONC-5-0001' });
      expect(result.caminhoes).toHaveLength(1);
      expect(result.corpos_de_prova).toHaveLength(1);
    });

    it('lança NotFoundException se obra não encontrada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.criar(TENANT_ID, OBRA_ID, USER_ID, dto as any))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── listar ──────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('retorna página com total correto', async () => {
      // validarObra
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: OBRA_ID }]);
      // COUNT
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 3 }]);
      // items
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockConcretagem, mockConcretagem, mockConcretagem]);

      const result = await svc.listar(TENANT_ID, OBRA_ID, { page: 1, limit: 20 } as any);

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('retorna página vazia quando não há concretagens', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: OBRA_ID }]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 0 }]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await svc.listar(TENANT_ID, OBRA_ID, {} as any);

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('lança NotFoundException se obra não encontrada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.listar(TENANT_ID, OBRA_ID, {} as any))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── buscar ──────────────────────────────────────────────────────────────

  describe('buscar()', () => {
    it('retorna concretagem com caminhões e CPs joined', async () => {
      prismaMock.$queryRawUnsafe
        .mockResolvedValueOnce([mockConcretagem])
        .mockResolvedValueOnce([mockCaminhao])
        .mockResolvedValueOnce([mockCp]);

      const result = await svc.buscar(TENANT_ID, 1);

      expect(result).toMatchObject({ id: 1 });
      expect(result.caminhoes).toHaveLength(1);
      expect(result.corpos_de_prova).toHaveLength(1);
    });

    it('lança NotFoundException se concretagem não encontrada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.buscar(TENANT_ID, 999))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── cancelar ────────────────────────────────────────────────────────────

  describe('cancelar()', () => {
    it('atualiza status para CANCELADA e retorna { id }', async () => {
      // buscar → concretagem, caminhoes, cps
      prismaMock.$queryRawUnsafe
        .mockResolvedValueOnce([mockConcretagem])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      // UPDATE concretagem
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);

      const result = await svc.cancelar(TENANT_ID, 1, USER_ID);

      expect(result).toEqual({ id: 1 });
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'CANCELADA'"),
        TENANT_ID,
        1,
      );
    });

    it('lança NotFoundException se concretagem não encontrada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.cancelar(TENANT_ID, 999, USER_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
