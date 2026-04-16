// backend/src/efetivo/cadastros/cadastros.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { CadastrosService } from './cadastros.service';

const TENANT_ID = 5;

const EMPRESA: any = {
  id: 1, tenant_id: TENANT_ID, nome: 'Construmax', tipo: 'PROPRIA',
  cnpj: '12.345.678/0001-90', ativa: true, criado_em: new Date(),
};
const FUNCAO: any = {
  id: 1, tenant_id: TENANT_ID, nome: 'Pedreiro', ativa: true, criado_em: new Date(),
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

function makeService(): CadastrosService {
  return new (CadastrosService as any)(mockPrisma);
}

describe('CadastrosService', () => {
  let svc: CadastrosService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  describe('getEmpresas()', () => {
    it('retorna empresas do tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([EMPRESA]);
      const result = await svc.getEmpresas(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        TENANT_ID,
      );
    });
  });

  describe('createEmpresa()', () => {
    it('insere empresa e retorna o objeto criado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([EMPRESA]);
      const dto = { nome: 'Construmax', tipo: 'PROPRIA' as const, cnpj: '12.345.678/0001-90' };
      const result = await svc.createEmpresa(TENANT_ID, dto);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO empresas_efetivo'),
        TENANT_ID, 'Construmax', 'PROPRIA', '12.345.678/0001-90',
      );
      expect(result.nome).toBe('Construmax');
    });

    it('usa SUBCONTRATADA como tipo padrão quando não informado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ ...EMPRESA, tipo: 'SUBCONTRATADA' }]);
      await svc.createEmpresa(TENANT_ID, { nome: 'MontaFácil' });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.anything(),
        TENANT_ID, 'MontaFácil', 'SUBCONTRATADA', null,
      );
    });
  });

  describe('updateEmpresa()', () => {
    it('lança NotFoundException quando empresa não existe no tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(svc.updateEmpresa(TENANT_ID, 999, { nome: 'X' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft delete: seta ativa=false', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([EMPRESA])
        .mockResolvedValueOnce([{ ...EMPRESA, ativa: false }]);
      const result = await svc.updateEmpresa(TENANT_ID, 1, { ativa: false });
      expect(result.ativa).toBe(false);
    });

    it('retorna empresa sem atualizar quando payload vazio', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([EMPRESA]);
      const result = await svc.updateEmpresa(TENANT_ID, 1, {});
      expect(result).toEqual(EMPRESA);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFuncoes()', () => {
    it('retorna funções do tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([FUNCAO]);
      const result = await svc.getFuncoes(TENANT_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('createFuncao()', () => {
    it('insere função e retorna o objeto criado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([FUNCAO]);
      const result = await svc.createFuncao(TENANT_ID, { nome: 'Pedreiro' });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO funcoes_efetivo'),
        TENANT_ID, 'Pedreiro',
      );
      expect(result.nome).toBe('Pedreiro');
    });
  });

  describe('updateFuncao()', () => {
    it('lança NotFoundException quando função não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(svc.updateFuncao(TENANT_ID, 999, { nome: 'X' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
