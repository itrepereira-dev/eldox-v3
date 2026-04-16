// backend/src/concretagem/corpos-de-prova/cps.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { CpsService } from './cps.service';

const TENANT_ID   = 10;
const BETONADA_ID = 1;
const CAMINHAO_ID = 1;
const CP_ID       = 1;
const USER_ID     = 42;

const mockBetonada: Record<string, unknown> = {
  id: BETONADA_ID,
  obra_id: 5,
  fck_especificado: 25,
};

const mockCp: Record<string, unknown> = {
  id: CP_ID,
  tenant_id: TENANT_ID,
  betonada_id: BETONADA_ID,
  caminhao_id: CAMINHAO_ID,
  numero: 'CP-1-1-001',
  idade_dias: 28,
  data_moldagem: '2026-04-15',
  data_ruptura_prev: '2026-05-13',
  data_ruptura_real: null,
  resistencia: null,
  status: 'AGUARDANDO_RUPTURA',
  alerta_enviado: false,
  created_at: new Date(),
};

const prismaMock = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): CpsService {
  return new (CpsService as any)(prismaMock);
}

describe('CpsService', () => {
  let svc: CpsService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── moldagem ─────────────────────────────────────────────────────────────

  describe('moldagem()', () => {
    const baseDto = {
      caminhao_id: CAMINHAO_ID,
      data_moldagem: '2026-04-15',
    };

    it('cria 3 CPs (idades 3, 7, 28 dias) quando idade_dias não informado', async () => {
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);

      // For each of 3 ages: gerarNumeroCp (COUNT) + INSERT (RETURNING id) + buscarCp
      for (let i = 0; i < 3; i++) {
        prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: i }]); // gerarNumeroCp COUNT
        prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: i + 1 }]); // INSERT RETURNING
        prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockCp, id: i + 1, idade_dias: [3, 7, 28][i] }]); // buscarCp
      }
      // auditLog (fire-and-forget)
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);

      const result = await svc.moldagem(TENANT_ID, BETONADA_ID, USER_ID, baseDto as any);

      expect(result).toHaveLength(3);
      expect((result[0] as any).idade_dias).toBe(3);
      expect((result[1] as any).idade_dias).toBe(7);
      expect((result[2] as any).idade_dias).toBe(28);
    });

    it('cria apenas 1 CP quando idade_dias=7 informado', async () => {
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // gerarNumeroCp
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 0 }]);
      // INSERT RETURNING
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: CP_ID }]);
      // buscarCp
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockCp, idade_dias: 7 }]);
      // auditLog
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);

      const result = await svc.moldagem(TENANT_ID, BETONADA_ID, USER_ID, {
        ...baseDto,
        idade_dias: 7,
      } as any);

      expect(result).toHaveLength(1);
      expect((result[0] as any).idade_dias).toBe(7);
    });

    it('lança NotFoundException se betonada não encontrada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.moldagem(TENANT_ID, 999, USER_ID, baseDto as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('número do CP segue formato CP-{betonadaId}-{caminhaoId}-{seq}', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // gerarNumeroCp — total = 2 → seq = 003
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ total: 2 }]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: CP_ID }]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockCp, numero: `CP-${BETONADA_ID}-${CAMINHAO_ID}-003` }]);
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);

      const result = await svc.moldagem(TENANT_ID, BETONADA_ID, USER_ID, {
        ...baseDto,
        idade_dias: 28,
      } as any);

      expect((result[0] as any).numero).toBe(`CP-${BETONADA_ID}-${CAMINHAO_ID}-003`);
    });
  });

  // ── registrarRuptura ─────────────────────────────────────────────────────

  describe('registrarRuptura()', () => {
    it('marca ROMPIDO_APROVADO quando resistencia >= fck_especificado', async () => {
      // buscarCp
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCp]);
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // UPDATE
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      // buscarCp final
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockCp, status: 'ROMPIDO_APROVADO', resistencia: 30 },
      ]);

      const result = await svc.registrarRuptura(TENANT_ID, CP_ID, USER_ID, {
        resistencia: 30, // >= fck 25
      } as any);

      expect(result).toMatchObject({ status: 'ROMPIDO_APROVADO', resistencia: 30 });
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('resistencia'),
        TENANT_ID,
        CP_ID,
        30,
        'ROMPIDO_APROVADO',
        expect.any(String),
        USER_ID,
        null,
      );
    });

    it('marca ROMPIDO_REPROVADO quando resistencia < fck_especificado', async () => {
      // buscarCp
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCp]);
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // UPDATE + auditLog (fire-and-forget)
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      // NC fire-and-forget: abrirNcAutomatica inserts into nao_conformidades
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: 99 }]); // NC INSERT RETURNING
      // buscarCp final
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockCp, status: 'ROMPIDO_REPROVADO', resistencia: 20 },
      ]);

      const result = await svc.registrarRuptura(TENANT_ID, CP_ID, USER_ID, {
        resistencia: 20, // < fck 25
      } as any);

      expect(result).toMatchObject({ status: 'ROMPIDO_REPROVADO', resistencia: 20 });
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('resistencia'),
        TENANT_ID,
        CP_ID,
        20,
        'ROMPIDO_REPROVADO',
        expect.any(String),
        USER_ID,
        null,
      );
    });

    it('lança NotFoundException se CP não encontrado', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.registrarRuptura(TENANT_ID, 999, USER_ID, { resistencia: 30 } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── listarPorBetonada ─────────────────────────────────────────────────────

  describe('listarPorBetonada()', () => {
    it('retorna lista de CPs da betonada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCp, { ...mockCp, id: 2 }]);

      const result = await svc.listarPorBetonada(TENANT_ID, BETONADA_ID);

      expect(result).toHaveLength(2);
    });

    it('retorna lista vazia quando não há CPs', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await svc.listarPorBetonada(TENANT_ID, BETONADA_ID);

      expect(result).toHaveLength(0);
    });
  });
});
