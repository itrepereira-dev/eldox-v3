// backend/src/fvs/catalogo/catalogo.service.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const TENANT_ID = 5;

const CAT_SISTEMA = { id: 1, tenant_id: 0, nome: 'Acabamento', ordem: 4, ativo: true, created_at: new Date() };
const CAT_TENANT  = { id: 99, tenant_id: TENANT_ID, nome: 'Minha Categoria', ordem: 0, ativo: true, created_at: new Date() };

const SRV_SISTEMA = { id: 10, tenant_id: 0, categoria_id: 1, codigo: 'PO 19.20', nome: 'EXECUÇÃO DE INSTALAÇÃO DE PORTAS', norma_referencia: null, ordem: 1, ativo: true, created_at: new Date(), deleted_at: null };
const SRV_TENANT  = { id: 200, tenant_id: TENANT_ID, categoria_id: 99, codigo: null, nome: 'Serviço Custom', norma_referencia: null, ordem: 0, ativo: true, created_at: new Date(), deleted_at: null };

const ITEM_SISTEMA = { id: 50, tenant_id: 0, servico_id: 10, descricao: 'ABERTURA E FECHAMENTO REGULAR?', criterio_aceite: null, criticidade: 'maior', foto_modo: 'opcional', foto_minimo: 0, foto_maximo: 2, ordem: 1, ativo: true, created_at: new Date() };

// ── Mock PrismaService ────────────────────────────────────────────────────────
const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): CatalogoService {
  return new (CatalogoService as any)(mockPrisma);
}

describe('CatalogoService', () => {
  let svc: CatalogoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── getCategorias ───────────────────────────────────────────────────────────
  describe('getCategorias()', () => {
    it('retorna categorias do sistema e do tenant com is_sistema calculado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { ...CAT_SISTEMA },
        { ...CAT_TENANT },
      ]);
      const result = await svc.getCategorias(TENANT_ID);
      expect(result).toHaveLength(2);
      expect(result[0].is_sistema).toBe(true);
      expect(result[1].is_sistema).toBe(false);
    });
  });

  // ── createCategoria ─────────────────────────────────────────────────────────
  describe('createCategoria()', () => {
    it('insere com tenant_id correto e retorna a categoria criada', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ ...CAT_TENANT }]);
      const dto = { nome: 'Minha Categoria', ordem: 0 };
      const result = await svc.createCategoria(TENANT_ID, dto as any);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_categorias_servico'),
        TENANT_ID,
        'Minha Categoria',
        0,
      );
      expect(result.nome).toBe('Minha Categoria');
    });
  });

  // ── assertNotSistema guard ──────────────────────────────────────────────────
  describe('updateCategoria() — guard sistema', () => {
    it('lança ForbiddenException ao tentar editar categoria do sistema', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ tenant_id: 0 }]);
      await expect(
        svc.updateCategoria(TENANT_ID, CAT_SISTEMA.id, { nome: 'hack' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança NotFoundException se categoria não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(
        svc.updateCategoria(TENANT_ID, 999, { nome: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── clonarServico ───────────────────────────────────────────────────────────
  describe('clonarServico()', () => {
    it('cria cópia do serviço com tenant_id do usuário, não do sistema', async () => {
      // 1ª chamada: busca o original com itens
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...SRV_SISTEMA }])          // getServico
        .mockResolvedValueOnce([{ ...ITEM_SISTEMA }])         // getItens do original
        .mockResolvedValueOnce([{ ...SRV_TENANT, id: 300 }]) // insert serviço clone
        .mockResolvedValue([]);                               // insert itens

      const clone = await svc.clonarServico(TENANT_ID, SRV_SISTEMA.id);
      expect(clone.tenant_id).toBe(TENANT_ID);
      expect(clone.is_sistema).toBe(false);
    });
  });

  // ── reordenarItens ──────────────────────────────────────────────────────────
  describe('reordenarItens()', () => {
    it('executa UPDATE para cada item com a nova ordem', async () => {
      mockPrisma.$transaction.mockResolvedValue(undefined);
      await svc.reordenarItens(TENANT_ID, SRV_TENANT.id, [
        { id: 50, ordem: 2 },
        { id: 51, ordem: 1 },
      ]);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── importarCsv ─────────────────────────────────────────────────────────────
  describe('importarCsv()', () => {
    const validCsv = 'categoria,codigo,nome,norma,item_descricao,criticidade,foto_modo\nAcabamento,PO 99,Serviço Importado,,Item Teste,menor,opcional';
    const invalidCsv = 'codigo,norma\nPO 99,NBR 123';

    it('lança BadRequestException se coluna "nome" ausente no CSV', async () => {
      await expect(
        svc.importarCsv(TENANT_ID, Buffer.from(invalidCsv), false),
      ).rejects.toBeInstanceOf(require('@nestjs/common').BadRequestException);
    });

    it('com dry_run=true retorna preview sem chamar queryRawUnsafe para INSERT', async () => {
      const result = await svc.importarCsv(TENANT_ID, Buffer.from(validCsv), true);
      expect(result.preview).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.total).toBe(1);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('com dry_run=false e CSV válido persiste registros', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1 }])  // busca categoria
        .mockResolvedValueOnce([{ id: 10 }]) // INSERT servico
        .mockResolvedValueOnce([{ id: 50, tenant_id: TENANT_ID, servico_id: 10, descricao: 'Item Teste', criterio_aceite: null, criticidade: 'menor', foto_modo: 'opcional', foto_minimo: 0, foto_maximo: 2, ordem: 0, ativo: true, created_at: new Date() }]); // INSERT item
      const result = await svc.importarCsv(TENANT_ID, Buffer.from(validCsv), false);
      expect(result.total).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
    });
  });
});
