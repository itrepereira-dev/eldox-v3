// backend/src/diario/rdo/rdo.service.spec.ts
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RdoService } from './rdo.service';
import type { CreateRdoDto } from './dto/create-rdo.dto';
import type { StatusRdoDto } from './dto/status-rdo.dto';
import type { UpdateClimaDto } from './dto/update-clima.dto';
import type { UpdateMaoObraDto } from './dto/update-mao-obra.dto';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 7;
const USER_ID   = 42;
const OBRA_ID   = 10;
const RDO_ID    = 100;

const RDO_PREENCHENDO = {
  id: RDO_ID,
  tenant_id: TENANT_ID,
  obra_id: OBRA_ID,
  data: '2026-04-14',
  numero: 1,
  status: 'preenchendo',
  criado_por: USER_ID,
  aprovado_por: null,
  aprovado_em: null,
  deleted_at: null,
};

const RDO_REVISAO  = { ...RDO_PREENCHENDO, status: 'revisao' };
const RDO_APROVADO = { ...RDO_PREENCHENDO, status: 'aprovado' };

const OBRA_ROW = [{ id: OBRA_ID, nome: 'Obra Teste' }];

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  $queryRawUnsafe:  jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

function makeService(): RdoService {
  return new (RdoService as any)(mockPrisma, mockQueue);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('RdoService', () => {
  let svc: RdoService;

  beforeEach(() => {
    jest.resetAllMocks();
    // $transaction chama fn(tx) e passa o próprio mock como tx
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    svc = makeService();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreateRdoDto = { obra_id: OBRA_ID, data: '2026-04-14' };

    it('cria RDO com sucesso e retorna rdo_id + status preenchendo', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce(OBRA_ROW)          // getObraOuFalhar
        .mockResolvedValueOnce([])                // verificar conflito (sem duplicata)
        .mockResolvedValueOnce([RDO_PREENCHENDO]) // INSERT rdos RETURNING *
        ;
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // gravarLogEdicao

      const result = await svc.create(TENANT_ID, USER_ID, dto);

      expect(result.rdo_id).toBe(RDO_ID);
      expect(result.status).toBe('preenchendo');
      expect(result.sugestoes_ia).toBeNull();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'acionar-agentes-ia',
        expect.objectContaining({ rdoId: RDO_ID, tenantId: TENANT_ID }),
        expect.any(Object),
      );
    });

    it('lança ConflictException (RDO_001) quando já existe RDO para a mesma data/obra', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce(OBRA_ROW)     // getObraOuFalhar
        .mockResolvedValueOnce([{ id: 99 }]) // conflito encontrado
        ;

      let thrown: any;
      try {
        await svc.create(TENANT_ID, USER_ID, dto);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBeInstanceOf(ConflictException);
      expect(thrown.response?.code).toBe('RDO_001');
    });

    it('lança NotFoundException quando obra não pertence ao tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // obra não encontrada

      await expect(svc.create(TENANT_ID, USER_ID, dto))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFoundException para obra de outro tenant', async () => {
      // Mesma semântica: query retorna vazio porque RLS filtra pelo tenant
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(svc.create(TENANT_ID, USER_ID, { obra_id: 999, data: '2026-04-14' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('não despacha job acionar-agentes-ia quando criação falha', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // obra não encontrada

      await expect(svc.create(TENANT_ID, USER_ID, dto)).rejects.toThrow();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('copia último RDO quando copiar_ultimo=true (método chamado na transação)', async () => {
      const dtoComCopia: CreateRdoDto = {
        obra_id: OBRA_ID, data: '2026-04-14',
        copiar_ultimo: true, copiar_campos: ['clima'],
      };

      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce(OBRA_ROW)          // getObraOuFalhar
        .mockResolvedValueOnce([])                // sem conflito de data
        .mockResolvedValueOnce([RDO_PREENCHENDO]) // INSERT rdos RETURNING *
        .mockResolvedValueOnce([{ id: 50 }])      // copiarUltimoRdo: busca RDO anterior
        .mockResolvedValueOnce([])                // copiarUltimoRdo: SELECT clima (vazio)
        ;
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.create(TENANT_ID, USER_ID, dtoComCopia);
      expect(result.rdo_id).toBe(RDO_ID);
      // copiado_de_id deve ter sido atualizado
      const updateCopiado = mockPrisma.$executeRawUnsafe.mock.calls.find(
        ([sql]: [string]) => sql.includes('copiado_de_id'),
      );
      expect(updateCopiado).toBeDefined();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('executa soft delete quando usuário é criador do RDO', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_PREENCHENDO]); // getRdoOuFalhar
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await expect(svc.remove(TENANT_ID, USER_ID, 'MEMBRO', RDO_ID))
        .resolves.toBeUndefined();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = NOW()'),
        RDO_ID,
        TENANT_ID,
      );
    });

    it('lança BadRequestException (RDO_004) quando status não é preenchendo', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_REVISAO]); // status revisao

      await expect(svc.remove(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança ForbiddenException (RDO_005) quando não é criador e não tem role suficiente', async () => {
      const rdoDeOutroUsuario = { ...RDO_PREENCHENDO, criado_por: 999 };
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([rdoDeOutroUsuario]);

      await expect(svc.remove(TENANT_ID, USER_ID, 'MEMBRO', RDO_ID))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite exclusão para ADMIN_TENANT mesmo não sendo criador', async () => {
      const rdoDeOutroUsuario = { ...RDO_PREENCHENDO, criado_por: 999 };
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([rdoDeOutroUsuario]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await expect(svc.remove(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID))
        .resolves.toBeUndefined();
    });

    it('permite exclusão para ENGENHEIRO mesmo não sendo criador', async () => {
      const rdoDeOutroUsuario = { ...RDO_PREENCHENDO, criado_por: 999 };
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([rdoDeOutroUsuario]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await expect(svc.remove(TENANT_ID, USER_ID, 'ENGENHEIRO', RDO_ID))
        .resolves.toBeUndefined();
    });

    it('lança NotFoundException quando RDO não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // não encontrado

      await expect(svc.remove(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    it('transição preenchendo → revisao é válida para qualquer role', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_PREENCHENDO]); // getRdoOuFalhar
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const dto: StatusRdoDto = { status: 'revisao' };
      const result = await svc.updateStatus(TENANT_ID, USER_ID, 'MEMBRO', RDO_ID, dto);

      expect(result.rdo_id).toBe(RDO_ID);
      expect(result.status).toBe('revisao');
      expect(mockQueue.add).not.toHaveBeenCalled(); // jobs só em aprovado
    });

    it('transição revisao → aprovado é válida para ENGENHEIRO', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_REVISAO]); // getRdoOuFalhar
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const dto: StatusRdoDto = { status: 'aprovado', assinatura_base64: 'base64==' };
      const result = await svc.updateStatus(TENANT_ID, USER_ID, 'ENGENHEIRO', RDO_ID, dto);

      expect(result.status).toBe('aprovado');
      // jobs gerar-resumo-ia e gerar-pdf devem ser enfileirados
      expect(mockQueue.add).toHaveBeenCalledWith(
        'gerar-resumo-ia',
        expect.objectContaining({ rdoId: RDO_ID }),
        expect.any(Object),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'gerar-pdf',
        expect.objectContaining({ rdoId: RDO_ID }),
        expect.any(Object),
      );
    });

    it('transição revisao → aprovado para ADMIN_TENANT é válida', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_REVISAO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await expect(
        svc.updateStatus(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID, { status: 'aprovado' }),
      ).resolves.toMatchObject({ status: 'aprovado' });
    });

    it('lança ForbiddenException (RDO_007) quando MEMBRO tenta aprovar', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_REVISAO]);

      await expect(
        svc.updateStatus(TENANT_ID, USER_ID, 'MEMBRO', RDO_ID, { status: 'aprovado' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança BadRequestException (RDO_006) quando transição é inválida (preenchendo → aprovado)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_PREENCHENDO]);

      await expect(
        svc.updateStatus(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID, { status: 'aprovado' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança BadRequestException (RDO_006) quando RDO já está aprovado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_APROVADO]);

      await expect(
        svc.updateStatus(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID, { status: 'revisao' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('insere assinatura no banco quando aprovado com assinatura_base64', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_REVISAO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.updateStatus(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID, {
        status: 'aprovado',
        assinatura_base64: 'data:image/png;base64,abc==',
      });

      // Deve ter chamado INSERT INTO rdo_assinaturas
      const insertAssinaturaCall = mockPrisma.$executeRawUnsafe.mock.calls.find(
        ([sql]: [string]) => sql.includes('rdo_assinaturas'),
      );
      expect(insertAssinaturaCall).toBeDefined();
      expect(insertAssinaturaCall[4]).toBe('data:image/png;base64,abc=='); // assinatura_base64
    });

    it('lança NotFoundException quando RDO não encontrado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.updateStatus(TENANT_ID, USER_ID, 'ADMIN_TENANT', RDO_ID, { status: 'revisao' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── upsertClima ───────────────────────────────────────────────────────────

  describe('upsertClima()', () => {
    const dtoTresPeriodos: UpdateClimaDto = {
      itens: [
        { periodo: 'manha', condicao: 'ensolarado', praticavel: true,  chuva_mm: 0,   aplicado_pelo_usuario: false },
        { periodo: 'tarde', condicao: 'chuvoso',    praticavel: false, chuva_mm: 12,  aplicado_pelo_usuario: true  },
        { periodo: 'noite', condicao: 'nublado',    praticavel: true,  chuva_mm: 3,   aplicado_pelo_usuario: false },
      ],
    };

    const climaRows = [
      { id: 1, rdo_id: RDO_ID, periodo: 'manha', condicao: 'ensolarado', praticavel: true },
      { id: 2, rdo_id: RDO_ID, periodo: 'tarde', condicao: 'chuvoso',    praticavel: false },
      { id: 3, rdo_id: RDO_ID, periodo: 'noite', condicao: 'nublado',    praticavel: true },
    ];

    it('faz upsert dos 3 períodos e retorna os registros atualizados', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO]) // getRdoOuFalhar
        .mockResolvedValueOnce(climaRows)         // SELECT final
        ;
      // $executeRawUnsafe para cada INSERT + gravarLogEdicao (6 chamadas total: 3 clima + 3 log)
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.upsertClima(TENANT_ID, USER_ID, RDO_ID, dtoTresPeriodos);

      expect(result).toHaveLength(3);
      expect(result[0].periodo).toBe('manha');
      expect(result[1].periodo).toBe('tarde');
      expect(result[2].periodo).toBe('noite');
    });

    it('usa ON CONFLICT para upsert (não duplica registros)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO])
        .mockResolvedValueOnce(climaRows.slice(0, 1));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.upsertClima(TENANT_ID, USER_ID, RDO_ID, { itens: [dtoTresPeriodos.itens[0]] });

      const insertCall = mockPrisma.$executeRawUnsafe.mock.calls.find(
        ([sql]: [string]) => sql.includes('ON CONFLICT'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![0]).toContain('rdo_clima');
    });

    it('grava log de edição para cada período atualizado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO])
        .mockResolvedValueOnce(climaRows);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.upsertClima(TENANT_ID, USER_ID, RDO_ID, dtoTresPeriodos);

      // 3 INSERT clima + 3 INSERT log = 6 chamadas de $executeRawUnsafe
      const logCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('rdo_log_edicoes'),
      );
      expect(logCalls).toHaveLength(3);
    });

    it('lança BadRequestException quando RDO está aprovado (não editável)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_APROVADO]);

      await expect(
        svc.upsertClima(TENANT_ID, USER_ID, RDO_ID, dtoTresPeriodos),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança NotFoundException quando RDO não encontrado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.upsertClima(TENANT_ID, USER_ID, RDO_ID, dtoTresPeriodos),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── substituirMaoObra ─────────────────────────────────────────────────────

  describe('substituirMaoObra()', () => {
    const dtoMaoObra: UpdateMaoObraDto = {
      itens: [
        { funcao: 'Pedreiro', quantidade: 3, tipo: 'proprio' },
        { funcao: 'Eletricista', quantidade: 1, tipo: 'subcontratado', hora_entrada: '08:00', hora_saida: '17:00' },
      ],
    };

    const maoObraRows = [
      { id: 1, rdo_id: RDO_ID, funcao: 'Eletricista', quantidade: 1 },
      { id: 2, rdo_id: RDO_ID, funcao: 'Pedreiro',    quantidade: 3 },
    ];

    it('deleta registros antigos e insere os novos (substituição completa)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO]) // getRdoOuFalhar
        .mockResolvedValueOnce(maoObraRows)       // SELECT final
        ;
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.substituirMaoObra(TENANT_ID, USER_ID, RDO_ID, dtoMaoObra);

      expect(result).toHaveLength(2);

      // Verifica DELETE antes do INSERT
      const deleteCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('DELETE FROM rdo_mao_de_obra'),
      );
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0][1]).toBe(RDO_ID);
      expect(deleteCalls[0][2]).toBe(TENANT_ID);
    });

    it('insere exatamente 2 registros (um por item do DTO)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO])
        .mockResolvedValueOnce(maoObraRows);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.substituirMaoObra(TENANT_ID, USER_ID, RDO_ID, dtoMaoObra);

      const insertCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('INSERT INTO rdo_mao_de_obra'),
      );
      expect(insertCalls).toHaveLength(2);
    });

    it('grava 1 log de edição com total_itens', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO])
        .mockResolvedValueOnce(maoObraRows);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.substituirMaoObra(TENANT_ID, USER_ID, RDO_ID, dtoMaoObra);

      const logCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('rdo_log_edicoes'),
      );
      expect(logCalls).toHaveLength(1);

      // valor_novo deve ter total_itens: 2
      const valorNovoArg = logCalls[0][6]; // posição $6 → valor_novo
      expect(JSON.parse(valorNovoArg)).toMatchObject({ total_itens: 2 });
    });

    it('lança BadRequestException quando RDO está aprovado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_APROVADO]);

      await expect(
        svc.substituirMaoObra(TENANT_ID, USER_ID, RDO_ID, dtoMaoObra),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança NotFoundException quando RDO não encontrado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.substituirMaoObra(TENANT_ID, USER_ID, RDO_ID, dtoMaoObra),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('para lista vazia de itens, deleta tudo e não insere nada', async () => {
      // UpdateMaoObraDto com itens vazios — edge case (ArrayNotEmpty valida no controller,
      // mas o service não deve travar com lista vazia se chamado diretamente)
      const dtoVazio = { itens: [] } as unknown as UpdateMaoObraDto;
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO])
        .mockResolvedValueOnce([]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.substituirMaoObra(TENANT_ID, USER_ID, RDO_ID, dtoVazio);

      expect(result).toHaveLength(0);
      const deleteCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('DELETE FROM rdo_mao_de_obra'),
      );
      expect(deleteCalls).toHaveLength(1);
      const insertCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('INSERT INTO rdo_mao_de_obra'),
      );
      expect(insertCalls).toHaveLength(0);
    });
  });

  // ── update (PATCH /rdos/:id) ──────────────────────────────────────────────

  describe('update()', () => {
    it('bloqueia atualização quando RDO está aprovado (RDO_003)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([RDO_APROVADO]);

      await expect(
        svc.update(TENANT_ID, USER_ID, RDO_ID, { observacao_geral: 'obs' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('grava log para cada campo alterado', async () => {
      const rdoAtualizado = { ...RDO_PREENCHENDO, observacao_geral: 'novo texto' };
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO]) // getRdoOuFalhar
        .mockResolvedValueOnce([rdoAtualizado])   // UPDATE rdos RETURNING *
        ;
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.update(TENANT_ID, USER_ID, RDO_ID, { observacao_geral: 'novo texto' } as any);

      expect(result).toMatchObject({ id: RDO_ID });
      const logCalls = mockPrisma.$executeRawUnsafe.mock.calls.filter(
        ([sql]: [string]) => sql.includes('rdo_log_edicoes'),
      );
      expect(logCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('lança BadRequestException quando obra_id não fornecido', async () => {
      await expect(
        svc.list(TENANT_ID, { obra_id: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('retorna estrutura correta com status_counts zerados quando sem RDOs', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([])          // rdos
        .mockResolvedValueOnce([{ total: 0 }]) // count
        .mockResolvedValueOnce([])          // status_counts GROUP BY
        ;

      const result = await svc.list(TENANT_ID, { obra_id: OBRA_ID });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.status_counts).toMatchObject({
        preenchendo: 0, revisao: 0, aprovado: 0, cancelado: 0,
      });
    });

    it('popula status_counts corretamente a partir do GROUP BY', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO, RDO_REVISAO]) // rdos
        .mockResolvedValueOnce([{ total: 2 }])
        .mockResolvedValueOnce([
          { status: 'preenchendo', contagem: 1 },
          { status: 'revisao',     contagem: 1 },
        ])
        ;

      const result = await svc.list(TENANT_ID, { obra_id: OBRA_ID });

      expect(result.total).toBe(2);
      expect(result.status_counts.preenchendo).toBe(1);
      expect(result.status_counts.revisao).toBe(1);
      expect(result.status_counts.aprovado).toBe(0);
    });

    it('aplica paginação com page/limit corretos', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 50 }])
        .mockResolvedValueOnce([])
        ;

      const result = await svc.list(TENANT_ID, { obra_id: OBRA_ID, page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      // offset = (3-1)*10 = 20 → verificar nas chamadas
      const listCall = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(listCall[7]).toBe(20); // $7 = offset
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('lança NotFoundException quando RDO não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(svc.findById(TENANT_ID, RDO_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna RDO completo com todas as seções quando encontrado', async () => {
      // 1 getRdoOuFalhar + 9 queries paralelas
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RDO_PREENCHENDO]) // getRdoOuFalhar
        .mockResolvedValueOnce([])  // clima
        .mockResolvedValueOnce([])  // mao_de_obra
        .mockResolvedValueOnce([])  // equipamentos
        .mockResolvedValueOnce([])  // atividades
        .mockResolvedValueOnce([])  // ocorrencias
        .mockResolvedValueOnce([])  // checklist_itens
        .mockResolvedValueOnce([])  // fotos
        .mockResolvedValueOnce([])  // assinaturas
        .mockResolvedValueOnce([])  // log_edicoes
        ;

      const result = await svc.findById(TENANT_ID, RDO_ID);

      expect(result.id).toBe(RDO_ID);
      expect(result).toHaveProperty('clima');
      expect(result).toHaveProperty('mao_obra');
      expect(result).toHaveProperty('equipamentos');
      expect(result).toHaveProperty('atividades');
      expect(result).toHaveProperty('checklist');
      expect(result).toHaveProperty('log_edicoes');
    });
  });
});
