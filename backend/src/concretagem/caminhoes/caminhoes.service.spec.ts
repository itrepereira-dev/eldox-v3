// backend/src/concretagem/caminhoes/caminhoes.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaminhoesService } from './caminhoes.service';

const TENANT_ID   = 10;
const BETONADA_ID = 1;
const CAMINHAO_ID = 1;
const USER_ID     = 42;

const mockBetonada: Record<string, unknown> = {
  id: BETONADA_ID,
  obra_id: 5,
  status: 'PROGRAMADA',
  data_programada: '2026-04-15',
};

const mockCaminhao: Record<string, unknown> = {
  id: CAMINHAO_ID,
  tenant_id: TENANT_ID,
  betonada_id: BETONADA_ID,
  sequencia: 1,
  numero_nf: 'NF-001',
  data_emissao_nf: '2026-04-14',
  volume: 8,
  motorista: 'João',
  placa: 'ABC-1234',
  slump_especificado: 10,
  slump_medido: null,
  temperatura: null,
  status: 'CHEGOU',
  nf_vencida: false,
};

const prismaMock = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): CaminhoesService {
  return new (CaminhoesService as any)(prismaMock);
}

describe('CaminhoesService', () => {
  let svc: CaminhoesService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── registrarChegada ────────────────────────────────────────────────────

  describe('registrarChegada()', () => {
    const baseDto = {
      numero_nf: 'NF-001',
      data_emissao_nf: '2026-04-14', // valid: 1 day before data_programada 2026-04-15
      volume: 8,
    };

    function mockChegadaHappyPath(nfVencida = false) {
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // seqRows
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ seq: 1 }]);
      // INSERT caminhao → RETURNING id
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: CAMINHAO_ID }]);
      // UPDATE betonada to EM_LANCAMENTO (betonada.status === PROGRAMADA)
      prismaMock.$executeRawUnsafe.mockResolvedValueOnce(1);
      // NC if nfVencida (fire-and-forget $queryRawUnsafe + $executeRawUnsafe skipped — void)
      // auditLog (fire-and-forget)
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      // buscarCaminhao
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockCaminhao, nf_vencida: nfVencida },
      ]);
    }

    it('registra chegada com NF válida e nf_vencida=false', async () => {
      mockChegadaHappyPath(false);

      const result = await svc.registrarChegada(TENANT_ID, BETONADA_ID, USER_ID, baseDto as any);

      expect(result).toMatchObject({ id: CAMINHAO_ID, nf_vencida: false });
    });

    it('seta nf_vencida=true quando data_emissao_nf é anterior a data_programada - 1 dia', async () => {
      // data_programada = 2026-04-15 → limite = 2026-04-14
      // data_emissao_nf = 2026-04-13 < 2026-04-14 → nf_vencida = true
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);   // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ seq: 1 }]);     // seqRows
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: CAMINHAO_ID }]); // INSERT caminhao
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);                  // UPDATE betonada + NC execute + auditLog
      // NC fire-and-forget: abrirNcAutomatica inserts into nao_conformidades
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: 99 }]);     // NC INSERT RETURNING
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockCaminhao, nf_vencida: true }]); // buscarCaminhao

      const result = await svc.registrarChegada(TENANT_ID, BETONADA_ID, USER_ID, {
        ...baseDto,
        data_emissao_nf: '2026-04-13',
      } as any);

      expect(result).toMatchObject({ nf_vencida: true });
    });

    it('auto-define sequência a partir do MAX existente', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ seq: 3 }]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: 2 }]);
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockCaminhao, id: 2, sequencia: 3 }]);

      const result = await svc.registrarChegada(TENANT_ID, BETONADA_ID, USER_ID, baseDto as any);

      expect(result).toMatchObject({ sequencia: 3 });
    });

    it('lança BadRequestException se betonada está CANCELADA', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockBetonada, status: 'CANCELADA' },
      ]);

      await expect(
        svc.registrarChegada(TENANT_ID, BETONADA_ID, USER_ID, baseDto as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança NotFoundException se betonada não encontrada', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.registrarChegada(TENANT_ID, BETONADA_ID, USER_ID, baseDto as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── registrarSlump ──────────────────────────────────────────────────────

  describe('registrarSlump()', () => {
    it('atualiza slump_medido e temperatura e retorna caminhão atualizado', async () => {
      // buscarCaminhao
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCaminhao]);
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // UPDATE
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      // buscarCaminhao final
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockCaminhao, slump_medido: 10, temperatura: 25 },
      ]);

      const result = await svc.registrarSlump(TENANT_ID, CAMINHAO_ID, USER_ID, {
        slump_medido: 10,
        temperatura: 25,
      } as any);

      expect(result).toMatchObject({ slump_medido: 10, temperatura: 25 });
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('slump_medido'),
        expect.anything(),
        expect.anything(),
        10,
        25,
      );
    });

    it('lança NotFoundException se caminhão não encontrado', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.registrarSlump(TENANT_ID, 999, USER_ID, { slump_medido: 10 } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── concluirLancamento ──────────────────────────────────────────────────

  describe('concluirLancamento()', () => {
    it('atualiza status para CONCLUIDO e retorna caminhão', async () => {
      // buscarCaminhao
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCaminhao]);
      // UPDATE
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      // buscarCaminhao final
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockCaminhao, status: 'CONCLUIDO' },
      ]);

      const result = await svc.concluirLancamento(TENANT_ID, CAMINHAO_ID, USER_ID);

      expect(result).toMatchObject({ status: 'CONCLUIDO' });
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'CONCLUIDO'"),
        TENANT_ID,
        CAMINHAO_ID,
      );
    });

    it('lança NotFoundException se caminhão não encontrado', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(svc.concluirLancamento(TENANT_ID, 999, USER_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── rejeitar ────────────────────────────────────────────────────────────

  describe('rejeitar()', () => {
    it('atualiza status para REJEITADO com motivo', async () => {
      // buscarCaminhao
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockCaminhao]);
      // buscarBetonada
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([mockBetonada]);
      // UPDATE + auditLog (fire-and-forget)
      prismaMock.$executeRawUnsafe.mockResolvedValue(1);
      // NC fire-and-forget: abrirNcAutomatica inserts into nao_conformidades
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ id: 99 }]); // NC INSERT RETURNING
      // buscarCaminhao final
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockCaminhao, status: 'REJEITADO', incidentes: 'concreto fora do prazo' },
      ]);

      const result = await svc.rejeitar(TENANT_ID, CAMINHAO_ID, USER_ID, 'concreto fora do prazo');

      expect(result).toMatchObject({ status: 'REJEITADO' });
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'REJEITADO'"),
        TENANT_ID,
        CAMINHAO_ID,
        'concreto fora do prazo',
      );
    });

    it('lança NotFoundException se caminhão não encontrado', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(svc.rejeitar(TENANT_ID, 999, USER_ID, 'motivo'))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
