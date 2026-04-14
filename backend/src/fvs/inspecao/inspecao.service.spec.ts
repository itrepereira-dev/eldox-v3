// backend/src/fvs/inspecao/inspecao.service.spec.ts
import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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

const mockRoServiceGlobal = { checkAndAdvanceRoStatus: jest.fn() };
const mockModeloService = { getModeloParaFicha: jest.fn(), incrementFichasCount: jest.fn() };

function makeService(): InspecaoService {
  return new (InspecaoService as any)(mockPrisma, mockGed, mockRoServiceGlobal, mockModeloService);
}

describe('InspecaoService', () => {
  let svc: InspecaoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── createFicha ─────────────────────────────────────────────────────────────
  describe('createFicha()', () => {
    it('lança BadRequestException se obraId não pertence ao tenant', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([]); // SELECT Obra → não encontrada no tenant

      await expect(
        svc.createFicha(TENANT_ID, USER_ID, {
          obraId: 999, nome: 'FVS', regime: 'livre',
          servicos: [{ servicoId: 1, localIds: [1] }],
        }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cria ficha com rascunho e grava audit_log quando regime=pbqph', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 10 }])            // SELECT Obra (validação tenant)
        .mockResolvedValueOnce([FICHA_RASCUNHO])        // INSERT fvs_fichas
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
        .mockResolvedValueOnce([{ id: 10 }])            // SELECT Obra (validação tenant)
        .mockResolvedValueOnce([{ ...FICHA_RASCUNHO, regime: 'livre' }])
        .mockResolvedValueOnce([{ id: 10 }]);           // INSERT fvs_ficha_servicos
      mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined); // INSERT fvs_ficha_servico_locais

      await svc.createFicha(TENANT_ID, USER_ID, {
        obraId: 10, nome: 'FVS Torre 1', regime: 'livre',
        servicos: [{ servicoId: 1, localIds: [1] }],
      }, '127.0.0.1');

      // audit_log NÃO deve ter sido chamado (apenas o INSERT locais foi)
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), expect.anything(),
      );
    });

    it('cria ficha via template — regime, flags e serviços vêm do template', async () => {
      const modeloFake = {
        id: 5, regime: 'pbqph', exige_ro: true, exige_reinspecao: false, exige_parecer: true,
      };
      const servicosFake = [{ servico_id: 10, ordem: 0, itens_excluidos: null }];
      const fichaFake = {
        id: 99, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Template',
        regime: 'pbqph', status: 'rascunho', criado_por: USER_ID,
        modelo_id: 5, exige_ro: true, exige_reinspecao: false, exige_parecer: true,
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      // SELECT Obra validation
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 10 }]);
      // getModeloParaFicha is called via modeloService mock
      mockModeloService.getModeloParaFicha.mockResolvedValueOnce({ modelo: modeloFake, servicos: servicosFake });
      // INSERT fvs_fichas
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([fichaFake]);
      // INSERT fvs_ficha_servicos (for the 1 template service)
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 1 }]);
      // incrementFichasCount
      mockModeloService.incrementFichasCount.mockResolvedValueOnce(undefined);
      // audit log (pbqph regime)
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createFicha(TENANT_ID, USER_ID, {
        obraId: 10, nome: 'FVS Template', modeloId: 5,
      });

      expect(result.modelo_id).toBe(5);
      expect(result.regime).toBe('pbqph');
      expect(mockModeloService.getModeloParaFicha).toHaveBeenCalledWith(
        mockPrisma, TENANT_ID, 5,
      );
      expect(mockModeloService.incrementFichasCount).toHaveBeenCalledWith(
        mockPrisma, TENANT_ID, 5, 10,
      );
    });

    it('cria ficha sem template — usa dto.servicos (comportamento existente)', async () => {
      const fichaFake = {
        id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Manual',
        regime: 'livre', status: 'rascunho', criado_por: USER_ID,
        modelo_id: null, exige_ro: true, exige_reinspecao: true, exige_parecer: true,
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      // SELECT Obra validation
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 10 }]);
      // INSERT fvs_fichas
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([fichaFake]);
      // INSERT fvs_ficha_servicos
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 1 }]);
      // INSERT fvs_ficha_servico_locais
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createFicha(TENANT_ID, USER_ID, {
        obraId: 10, nome: 'FVS Manual', regime: 'livre',
        servicos: [{ servicoId: 1, localIds: [100] }],
      });

      expect(result.modelo_id).toBeNull();
      expect(mockModeloService.getModeloParaFicha).not.toHaveBeenCalled();
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

    it('concluida→aprovada direto quando exige_parecer=false', async () => {
      const fichaComParecer = { ...FICHA_EM_INSPECAO, status: 'concluida', exige_parecer: false, exige_ro: false };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaComParecer])
        .mockResolvedValueOnce([{ ...fichaComParecer, status: 'aprovada' }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'aprovada' }, '127.0.0.1');
      expect(result.status).toBe('aprovada');
    });

    it('concluida→aprovada lança erro quando exige_parecer=true', async () => {
      const fichaComParecer = { ...FICHA_EM_INSPECAO, status: 'concluida', exige_parecer: true, exige_ro: false };
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([fichaComParecer]);
      await expect(
        svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'aprovada' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('autoCreateRo não é chamado quando exige_ro=false', async () => {
      const ficha = { ...FICHA_EM_INSPECAO, status: 'em_inspecao', regime: 'livre', exige_ro: false, exige_parecer: true };
      const fichaAtualizada = { ...ficha, status: 'concluida' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([ficha])               // getFichaOuFalhar
        .mockResolvedValueOnce([fichaAtualizada])      // UPDATE fvs_fichas
        .mockResolvedValueOnce([{ exige_ro: false }]); // autoCreateRo: guard SELECT exige_ro → retorna early
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1');
      // autoCreateRo executa guard SELECT exige_ro e retorna cedo (sem buscar NCs)
      // Verificar: $queryRawUnsafe foi chamado 3x (buscar ficha + UPDATE + guard), sem busca de NCs
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
      // Garantir que não tentou buscar itens NC (indicativo de que o RO NÃO foi criado)
      const callArgs = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls;
      const ncQuery = callArgs.find((call: any[]) => typeof call[0] === 'string' && call[0].includes('nao_conforme'));
      expect(ncQuery).toBeUndefined();
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

  // ── getGrade Sprint 5 — resumo ───────────────────────────────────────────────
  describe('getGrade() — Sprint 5 resumo', () => {
    it('inclui resumo com contagem de células por status', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1 }])                   // getFichaOuFalhar
        // locais (nova ordem!)
        .mockResolvedValueOnce([
          { id: 101, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: '1o Pav', ordem: 1 },
        ])
        // servicos
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: 'ALV' }])
        // registros
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 101, status: 'conforme', itens_total: 3, itens_avaliados: 3, itens_nc: 0, ultimo_inspetor: null, ultima_atividade: null },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1, {});

      expect(result.resumo).toBeDefined();
      expect(result.resumo.aprovadas).toBe(1);
      expect(result.resumo.total_celulas).toBe(1);
      expect(result.resumo.progresso_pct).toBe(100);
    });
  });

  // ── getGrade ────────────────────────────────────────────────────────────────
  describe('getGrade()', () => {
    it('retorna grade com células agregadas por 4 estados', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])   // getFichaOuFalhar
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: null, ordem: 0 }, { id: 11, nome: 'Ap 102', pavimento_id: 1, pavimento_nome: null, ordem: 0 }])  // locais
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
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
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: null, ordem: 0 }])  // locais
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
        .mockResolvedValueOnce([]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('nao_avaliado');
    });

    it('mix de conforme e nao_avaliado (sem NC) = parcial', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: null, ordem: 0 }])  // locais
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 10, status: 'conforme' },
          { servico_id: 1, obra_local_id: 10, status: 'nao_avaliado' },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('parcial');
    });

    it('excecao alone = aprovado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: null, ordem: 0 }])  // locais
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
        .mockResolvedValueOnce([{ servico_id: 1, obra_local_id: 10, status: 'excecao' }]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('aprovado');
    });

    it('NC mixed com conforme → nc vence (prioridade NC)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: null, ordem: 0 }])  // locais
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
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

    it('regime=pbqph, status=nao_conforme sem observacao → 400', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ status: 'nao_avaliado' }]);  // status atual
      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('regime=pbqph, status=nao_conforme COM observacao → salva e grava audit_log', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])              // getFichaOuFalhar
        .mockResolvedValueOnce([{ status: 'nao_avaliado' }])     // buscar status atual
        .mockResolvedValueOnce([{ criticidade: 'critico' }])     // buscar item
        .mockResolvedValueOnce([{ id: 5, ficha_id: 1, status: 'nao_conforme', ciclo: 1 }]) // upsert retorno
        // autoCreateNc:
        .mockResolvedValueOnce([])                               // verificar NC existente
        .mockResolvedValueOnce([{ seq: 1 }])                     // próximo seq
        .mockResolvedValueOnce([{ codigo: 'ALV' }])              // codigo serviço
        .mockResolvedValueOnce([{ id: 1 }]);                     // INSERT NC
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme', observacao: 'Desvio observado',
      }, '127.0.0.1');

      expect(result.status).toBe('nao_conforme');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        TENANT_ID, 1, 5, 'inspecao',
        'nao_avaliado',      // status_de (novo campo!)
        'nao_conforme',
        USER_ID, '127.0.0.1',
        expect.stringContaining('"itemId"'),
      );
    });

    it('regime=livre, status=nao_conforme COM observacao → salva sem audit_log', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
        .mockResolvedValueOnce([{ status: 'nao_avaliado' }])    // status atual
        .mockResolvedValueOnce([{ criticidade: 'menor' }])
        .mockResolvedValueOnce([{ id: 5, ficha_id: 1, status: 'nao_conforme', ciclo: 1 }])
        // autoCreateNc:
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ seq: 1 }])
        .mockResolvedValueOnce([{ codigo: 'ALV' }])
        .mockResolvedValueOnce([{ id: 1 }]);

      const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme', observacao: 'Desvio',
      }, '127.0.0.1');

      expect(result.status).toBe('nao_conforme');
      // A nova lógica de audit_log inclui nao_conforme independente de regime
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        expect.anything(), expect.anything(), expect.anything(), 'inspecao',
        expect.anything(), 'nao_conforme',
        expect.anything(), expect.anything(), expect.anything(),
      );
    });
  });

  describe('putRegistro() — validações Sprint 4b', () => {
    const FICHA_APROVADA = { ...FICHA_RASCUNHO, status: 'aprovada' };

    it('lança ConflictException (409) para ficha aprovada', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_APROVADA]);
      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'conforme' }, '127.0.0.1'),
      ).rejects.toThrow('Ficha aprovada. Nenhuma alteração permitida.');
    });

    it('lança UnprocessableEntityException para transição inválida conforme→conforme_apos_reinspecao', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ status: 'conforme' }]);   // status atual do registro

      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'conforme_apos_reinspecao' }, '127.0.0.1'),
      ).rejects.toThrow('Transição inválida: conforme → conforme_apos_reinspecao');
    });

    it('lança BadRequestException para nao_conforme sem observacao (qualquer regime)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
        .mockResolvedValueOnce([{ status: 'nao_avaliado' }]);   // status atual

      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme' }, '127.0.0.1'),
      ).rejects.toThrow('Observação é obrigatória para não conformidade');
    });

    it('lança BadRequestException para nc_apos_reinspecao sem observacao', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
        .mockResolvedValueOnce([{ status: 'nao_conforme' }]);   // status atual

      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nc_apos_reinspecao' }, '127.0.0.1'),
      ).rejects.toThrow('Observação é obrigatória para NC após reinspeção');
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

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenNthCalledWith(1,
        expect.stringContaining('DELETE FROM fvs_evidencias'), 1, TENANT_ID,
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        TENANT_ID, expect.anything(), expect.anything(),
        'remover_evidencia', null, null,
        USER_ID, '127.0.0.1', null,
      );
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

  // ── autoCreateRo (via patchFicha em_inspecao→concluida) ──────────────────────
  describe('patchFicha() em_inspecao→concluida com NCs → autoCreateRo', () => {
    it('cria ro_ocorrencias quando há itens NC ao concluir', async () => {
      const fichaEmInspecao = { ...FICHA_EM_INSPECAO, exige_ro: true };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaEmInspecao])       // getFichaOuFalhar
        // validarConclusaoPbqph: sem itens críticos sem foto
        .mockResolvedValueOnce([])
        // UPDATE fvs_fichas
        .mockResolvedValueOnce([{ ...fichaEmInspecao, status: 'concluida' }])
        // autoCreateRo: guard — SELECT exige_ro
        .mockResolvedValueOnce([{ exige_ro: true }])
        // autoCreateRo: buscar itens NC
        .mockResolvedValueOnce([{
          registro_id: 5, item_id: 3, servico_id: 10, obra_local_id: 20,
          item_descricao: 'Prumo da alvenaria', item_criticidade: 'maior',
          servico_nome: 'Alvenaria',
        }])
        // autoCreateRo: MAX(ciclo_numero) dos ROs existentes
        .mockResolvedValueOnce([{ max_ciclo: null }])
        // INSERT ro_ocorrencias
        .mockResolvedValueOnce([{ id: 1, numero: 'RO-1-1' }])
        // INSERT ro_servicos_nc
        .mockResolvedValueOnce([{ id: 1 }]);

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log + INSERT ro_servico_itens_nc

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1');
      expect(result.status).toBe('concluida');
      // ro_ocorrencias inserido (tenant_id, ficha_id, ciclo_numero, numero, responsavel_id)
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ro_ocorrencias'),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(),
      );
    });

    it('NÃO cria RO quando não há NCs', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, exige_ro: true }])  // getFichaOuFalhar
        .mockResolvedValueOnce([])                       // validarConclusaoPbqph
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, status: 'concluida', exige_ro: true }]) // UPDATE
        .mockResolvedValueOnce([{ exige_ro: true }])     // autoCreateRo: guard
        .mockResolvedValueOnce([]);                      // autoCreateRo: sem NCs

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1');
      expect(result.status).toBe('concluida');
      // ro_ocorrencias NÃO foi inserido
      const insertRoCalls = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls
        .filter((call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO ro_ocorrencias'));
      expect(insertRoCalls).toHaveLength(0);
    });
  });

  // ── getGrade ciclo-aware ──────────────────────────────────────────────────────
  describe('getGrade() com ciclos', () => {
    it('usa ciclo mais recente por item para calcular status da célula', async () => {
      // Item teve NC no ciclo 1, mas conforme no ciclo 2 → célula deve ser 'aprovado'
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: null, ordem: 0 }])  // locais
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
        // getGrade retorna status do ciclo mais recente por (servico_id, obra_local_id)
        .mockResolvedValueOnce([{ servico_id: 1, obra_local_id: 10, status: 'conforme' }]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('aprovado');
    });
  });

  // ── putRegistro com ciclo > 1 ─────────────────────────────────────────────────
  describe('putRegistro() com ciclo > 1 (reinspeção)', () => {
    it('salva registro com ciclo=2 e chama checkAndAdvanceRoStatus', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])          // getFichaOuFalhar
        .mockResolvedValueOnce([{ status: 'nao_avaliado' }]) // buscar status atual
        .mockResolvedValueOnce([{ criticidade: 'maior' }])   // buscar item
        .mockResolvedValueOnce([{ id: 5, status: 'conforme', ciclo: 2 }]); // upsert retorno
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      // checkAndAdvanceRoStatus é mockado via mockRoService
      const mockRoService = { checkAndAdvanceRoStatus: jest.fn().mockResolvedValue(undefined) };
      const svcComRo = new (InspecaoService as any)(mockPrisma, {}, mockRoService);

      const result = await svcComRo.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'conforme', ciclo: 2,
      }, '127.0.0.1');

      expect(result.status).toBe('conforme');
      expect(mockRoService.checkAndAdvanceRoStatus).toHaveBeenCalledWith(TENANT_ID, 1);
    });

    it('NÃO chama checkAndAdvanceRoStatus para ciclo=1', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ status: 'nao_avaliado' }]) // buscar status atual
        .mockResolvedValueOnce([{ criticidade: 'menor' }])
        .mockResolvedValueOnce([{ id: 5, status: 'conforme', ciclo: 1 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const mockRoService = { checkAndAdvanceRoStatus: jest.fn() };
      const svcComRo = new (InspecaoService as any)(mockPrisma, {}, mockRoService);

      await svcComRo.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'conforme',
        // ciclo não informado → padrão 1
      }, '127.0.0.1');

      expect(mockRoService.checkAndAdvanceRoStatus).not.toHaveBeenCalled();
    });
  });

  // ── autoCreateNc via putRegistro ─────────────────────────────────────────────
  describe('putRegistro() — auto-criação de NC', () => {
    it('cria fvs_nao_conformidades ao transicionar para nao_conforme', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])           // getFichaOuFalhar
        .mockResolvedValueOnce([])                             // registroAtual (nao_avaliado)
        .mockResolvedValueOnce([{ criticidade: 'maior' }])    // buscar criticidade
        .mockResolvedValueOnce([{ id: 7, ficha_id: 1, status: 'nao_conforme', ciclo: 1 }]) // upsert registro
        // autoCreateNc:
        .mockResolvedValueOnce([])                             // verificar NC existente
        .mockResolvedValueOnce([{ seq: 1 }])                  // próximo seq
        .mockResolvedValueOnce([{ codigo: 'ALV' }])           // codigo do serviço
        .mockResolvedValueOnce([{ id: 1, numero: 'NC-1-ALV-001' }]); // INSERT NC

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme', observacao: 'Junta fora da tolerância',
      }, '127.0.0.1');

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_nao_conformidades'),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(),
      );
    });

    it('encerra NC ao transicionar para conforme_apos_reinspecao', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ status: 'nao_conforme' }])   // status atual
        .mockResolvedValueOnce([{ criticidade: 'menor' }])
        .mockResolvedValueOnce([{ id: 9, ficha_id: 1, status: 'conforme_apos_reinspecao', ciclo: 2 }]) // upsert
        .mockResolvedValueOnce([{ id: 3 }]);                  // encerrarNc: UPDATE NC

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'conforme_apos_reinspecao', observacao: 'Corrigido', ciclo: 2,
      }, '127.0.0.1');

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fvs_nao_conformidades'),
        'encerrada', 'conforme_apos_reinspecao',
        expect.anything(), expect.anything(), expect.anything(),
      );
    });
  });

  // ── calcularStatusCelula ──────────────────────────────────────────────────────
  describe('calcularStatusCelula() — Sprint 4b', () => {
    it('retorna nc quando há nao_conforme', () => {
      expect((svc as any).calcularStatusCelula(['conforme', 'nao_conforme'])).toBe('nc');
    });
    it('retorna nc quando há retrabalho', () => {
      expect((svc as any).calcularStatusCelula(['conforme', 'retrabalho'])).toBe('nc');
    });
    it('retorna nc_final quando há nc_apos_reinspecao e não há nao_conforme', () => {
      expect((svc as any).calcularStatusCelula(['conforme', 'nc_apos_reinspecao'])).toBe('nc_final');
    });
    it('prefere nc sobre nc_final quando ambos presentes', () => {
      expect((svc as any).calcularStatusCelula(['nao_conforme', 'nc_apos_reinspecao'])).toBe('nc');
    });
    it('retorna parcial quando há nao_avaliado misturado com avaliado', () => {
      expect((svc as any).calcularStatusCelula(['conforme', 'nao_avaliado'])).toBe('parcial');
    });
    it('retorna nao_avaliado quando todos são nao_avaliado', () => {
      expect((svc as any).calcularStatusCelula(['nao_avaliado', 'nao_avaliado'])).toBe('nao_avaliado');
    });
    it('retorna aprovado quando todos são conforme/conforme_apos_reinspecao/excecao', () => {
      expect((svc as any).calcularStatusCelula(['conforme', 'conforme_apos_reinspecao', 'excecao'])).toBe('aprovado');
    });
    it('retorna liberado quando todos são liberado_com_concessao', () => {
      expect((svc as any).calcularStatusCelula(['liberado_com_concessao', 'liberado_com_concessao'])).toBe('liberado');
    });
    it('retorna aprovado para mix de liberado+conforme+conforme_apos_reinspecao', () => {
      expect((svc as any).calcularStatusCelula(['liberado_com_concessao', 'conforme_apos_reinspecao'])).toBe('aprovado');
    });
  });

  // ── bulkInspecaoLocais ────────────────────────────────────────────────────────
  describe('bulkInspecaoLocais()', () => {
    it('lança BadRequestException se status=nao_conforme', async () => {
      await expect(
        svc.bulkInspecaoLocais(TENANT_ID, 1, USER_ID, {
          servicoId: 1, localIds: [1, 2], status: 'nao_conforme' as any,
        }, '127.0.0.1'),
      ).rejects.toThrow('Inspeção em massa não permite não conformidade');
    });

    it('processa apenas locais nao_avaliado, ignora os avaliados', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])  // getFichaOuFalhar
        .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])  // getItensDoServico
        .mockResolvedValueOnce([{ item_id: 10, obra_local_id: 1, status: 'conforme' }, { item_id: 11, obra_local_id: 1, status: 'conforme' }])  // local 1 já avaliado
        .mockResolvedValueOnce([]);  // local 2 sem registros = nao_avaliado

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.bulkInspecaoLocais(TENANT_ID, 1, USER_ID, {
        servicoId: 1, localIds: [1, 2], status: 'conforme',
      }, '127.0.0.1');

      expect(result.processados).toBe(1);
      expect(result.ignorados).toBe(1);
      expect(result.erros).toBe(0);
    });
  });

  // ── getNcs ────────────────────────────────────────────────────────────────────
  describe('getNcs()', () => {
    it('retorna lista de NCs com filtros', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([
          { id: 1, numero: 'NC-1-ALV-001', status: 'aberta', criticidade: 'maior',
            servico_nome: 'Alvenaria', item_descricao: 'Prumo', local_nome: 'Ap 101',
            sla_status: 'no_prazo', prazo_resolucao: null, criado_em: new Date() },
        ])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await svc.getNcs(TENANT_ID, 1, {});
      expect(result.total).toBe(1);
      expect(result.ncs[0].numero).toBe('NC-1-ALV-001');
    });
  });

  // ── registrarTratamento ───────────────────────────────────────────────────────
  describe('registrarTratamento()', () => {
    it('insere tratamento e atualiza NC para em_tratamento', async () => {
      const prazoFuturo = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 3, status: 'aberta', ficha_id: 1 }])  // buscar NC
        .mockResolvedValueOnce([{ max_ciclo: null }])                         // max ciclo (nenhum)
        .mockResolvedValueOnce([{ id: 10 }]);                                 // INSERT tratamento

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // UPDATE NC

      await svc.registrarTratamento(TENANT_ID, 1, 3, USER_ID, {
        descricao: 'Realinhamento', acaoCorretiva: 'Refazer fiadas', responsavelId: 5, prazo: prazoFuturo,
      });

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fvs_nao_conformidades'),
        'em_tratamento', expect.anything(), expect.anything(), expect.anything(), 3, TENANT_ID,
      );
    });

    it('lança BadRequestException para prazo no passado', async () => {
      const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 3, status: 'aberta', ficha_id: 1 }]);

      await expect(
        svc.registrarTratamento(TENANT_ID, 1, 3, USER_ID, {
          descricao: 'X', acaoCorretiva: 'Y', responsavelId: 5, prazo: ontem,
        }),
      ).rejects.toThrow('Prazo deve ser igual ou posterior à data atual');
    });
  });

  // ── getGrade — Sprint 5 ────────────────────────────────────────────────────
  describe('getGrade() — Sprint 5 resumo', () => {
    it('inclui resumo com contagem de células por status', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1 }])           // getFichaOuFalhar
        .mockResolvedValueOnce([                       // locais
          { id: 101, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: '1º Pav', ordem: 1 },
        ])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: 'ALV' }])  // servicos
        .mockResolvedValueOnce([                       // registros
          {
            servico_id: 1, obra_local_id: 101, status: 'conforme',
            itens_total: 3, itens_avaliados: 3, itens_nc: 0,
            ultimo_inspetor: null, ultima_atividade: null,
          },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1, {});

      expect(result.resumo).toBeDefined();
      expect(result.resumo.aprovadas).toBe(1);
      expect(result.resumo.total_celulas).toBe(1);
      expect(result.resumo.progresso_pct).toBe(100);
    });

    it('calcula progresso_pct = 0 quando todas as células são nao_avaliado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1 }])   // getFichaOuFalhar
        .mockResolvedValueOnce([               // locais
          { id: 101, nome: 'Ap 101', pavimento_id: null, pavimento_nome: null, ordem: 0 },
          { id: 102, nome: 'Ap 102', pavimento_id: null, pavimento_nome: null, ordem: 1 },
        ])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: null }])  // servicos
        .mockResolvedValueOnce([]);            // nenhum registro

      const result = await svc.getGrade(TENANT_ID, 1, {});

      expect(result.resumo.total_celulas).toBe(2);
      expect(result.resumo.nao_avaliadas).toBe(2);
      expect(result.resumo.progresso_pct).toBe(0);
    });
  });
});
