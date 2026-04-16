// backend/src/fvs/modelos/modelo.service.spec.ts
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ModeloService } from './modelo.service';

const TENANT_ID = 5;
const USER_ID = 42;
const MODELO_ID = 1;

const MODELO_RASCUNHO = {
  id: MODELO_ID, tenant_id: TENANT_ID,
  nome: 'Template Alvenaria', descricao: null, versao: 1,
  escopo: 'empresa', obra_id: null, status: 'rascunho',
  bloqueado: false, regime: 'livre',
  exige_ro: true, exige_reinspecao: true, exige_parecer: true,
  concluido_por: null, concluido_em: null, criado_por: USER_ID, deleted_at: null,
};

const MODELO_CONCLUIDO = { ...MODELO_RASCUNHO, status: 'concluido', concluido_por: USER_ID };
const MODELO_BLOQUEADO = { ...MODELO_CONCLUIDO, bloqueado: true };

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService() {
  return new (ModeloService as any)(mockPrisma);
}

describe('ModeloService', () => {
  let svc: ModeloService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── createModelo ──────────────────────────────────────────────────────────
  describe('createModelo()', () => {
    it('cria modelo com status=rascunho e criado_por=userId', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_RASCUNHO]);
      const dto = { nome: 'Template Alvenaria', escopo: 'empresa' as const, regime: 'livre' as const };
      const result = await svc.createModelo(TENANT_ID, USER_ID, dto);
      expect(result.status).toBe('rascunho');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_modelos'),
        TENANT_ID, dto.nome, undefined, 'empresa', null, 'livre',
        true, true, true, 'apenas_nc', null, USER_ID,
      );
    });

    it('escopo=obra com obraId válido — grava obra_id', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...MODELO_RASCUNHO, escopo: 'obra', obra_id: 99 }]);
      const dto = { nome: 'T', escopo: 'obra' as const, regime: 'livre' as const, obraId: 99 };
      const result = await svc.createModelo(TENANT_ID, USER_ID, dto);
      expect(result.obra_id).toBe(99);
    });
  });

  // ── getModelo ─────────────────────────────────────────────────────────────
  describe('getModelo()', () => {
    it('lança NotFoundException se não existe no tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.getModelo(TENANT_ID, 999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna modelo com serviços', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10, modelo_id: MODELO_ID, servico_id: 1, servico_nome: 'Alvenaria', ordem: 0, itens_excluidos: null }]);
      const result = await svc.getModelo(TENANT_ID, MODELO_ID);
      expect(result.servicos).toHaveLength(1);
    });
  });

  // ── concluirModelo ────────────────────────────────────────────────────────
  describe('concluirModelo()', () => {
    it('lança UnprocessableEntityException se não há serviços', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([]); // sem serviços
      await expect(svc.concluirModelo(TENANT_ID, MODELO_ID, USER_ID))
        .rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lança ConflictException se já concluido', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_CONCLUIDO]);
      await expect(svc.concluirModelo(TENANT_ID, MODELO_ID, USER_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('grava concluido_por e concluido_em ao concluir', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10 }])           // 1 serviço
        .mockResolvedValueOnce([MODELO_CONCLUIDO]);    // UPDATE retorno
      const result = await svc.concluirModelo(TENANT_ID, MODELO_ID, USER_ID);
      expect(result.status).toBe('concluido');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('concluido_por'),
        USER_ID, MODELO_ID, TENANT_ID,
      );
    });
  });

  // ── reabrirModelo ─────────────────────────────────────────────────────────
  describe('reabrirModelo()', () => {
    it('lança ForbiddenException se bloqueado=true', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_BLOQUEADO]);
      await expect(svc.reabrirModelo(TENANT_ID, MODELO_ID))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança ConflictException se status=rascunho', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_RASCUNHO]);
      await expect(svc.reabrirModelo(TENANT_ID, MODELO_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('reverte para rascunho quando concluido e não bloqueado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_CONCLUIDO])
        .mockResolvedValueOnce([{ ...MODELO_RASCUNHO }]);
      const result = await svc.reabrirModelo(TENANT_ID, MODELO_ID);
      expect(result.status).toBe('rascunho');
    });
  });

  // ── duplicarModelo ────────────────────────────────────────────────────────
  describe('duplicarModelo()', () => {
    it('cria novo modelo com versao+1, status=rascunho, escopo=empresa, criado_por=userId', async () => {
      const servicos = [{ id: 10, servico_id: 1, ordem: 0, itens_excluidos: null }];
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_CONCLUIDO])      // buscar original
        .mockResolvedValueOnce(servicos)                // buscar serviços
        .mockResolvedValueOnce([{ ...MODELO_RASCUNHO, id: 2, versao: 2, nome: 'Template Alvenaria (cópia)' }]); // INSERT

      const result = await svc.duplicarModelo(TENANT_ID, MODELO_ID, USER_ID);
      expect(result.versao).toBe(2);
      expect(result.status).toBe('rascunho');
      expect(result.nome).toContain('(cópia)');
    });
  });

  // ── vincularObras ─────────────────────────────────────────────────────────
  describe('vincularObras()', () => {
    it('lança ConflictException se modelo não está concluido', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_RASCUNHO]);
      await expect(svc.vincularObras(TENANT_ID, MODELO_ID, [10], USER_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('lança ConflictException se escopo=obra e obraId diferente', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { ...MODELO_CONCLUIDO, escopo: 'obra', obra_id: 77 }
      ]);
      await expect(svc.vincularObras(TENANT_ID, MODELO_ID, [99], USER_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('insere em obra_modelo_fvs para cada obraId', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_CONCLUIDO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      await svc.vincularObras(TENANT_ID, MODELO_ID, [10, 11], USER_ID);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO obra_modelo_fvs'),
        TENANT_ID, 10, MODELO_ID, USER_ID,
      );
    });
  });

  // ── addServicoModelo ──────────────────────────────────────────────────────
  describe('addServicoModelo()', () => {
    it('lança ForbiddenException se modelo está bloqueado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_BLOQUEADO]);
      await expect(svc.addServicoModelo(TENANT_ID, MODELO_ID, { servicoId: 1 }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança ForbiddenException se modelo está concluido (não rascunho)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_CONCLUIDO]);
      await expect(svc.addServicoModelo(TENANT_ID, MODELO_ID, { servicoId: 1 }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('insere serviço quando modelo em rascunho', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10 }]); // INSERT retorno
      await svc.addServicoModelo(TENANT_ID, MODELO_ID, { servicoId: 1 });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_modelo_servicos'),
        TENANT_ID, MODELO_ID, 1, 0, null, '{}',
      );
    });
  });
});
