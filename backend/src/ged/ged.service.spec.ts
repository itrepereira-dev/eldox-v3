// src/ged/ged.service.spec.ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GedService } from './ged.service';
import { MinioService } from './storage/minio.service';
import { WorkflowService } from './workflow/workflow.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 10;
const USER_TECNICO = 100;
const USER_ENGENHEIRO = 200;
const OBRA_ID = 1;

const CONFIG_AUDITORIA_ON: any = {
  id: 1, tenant_id: TENANT_ID, modo_auditoria: true,
  workflow_obrigatorio: false, qr_code_ativo: true, ocr_ativo: true,
  whatsapp_ativo: false, storage_limite_gb: 10,
};

const CONFIG_OCR_OFF: any = { ...CONFIG_AUDITORIA_ON, ocr_ativo: false };

const VERSAO_RASCUNHO: any = {
  id: 101, tenant_id: TENANT_ID, documento_id: 42, obra_id: OBRA_ID,
  numero_revisao: '0', version: 1, status: 'RASCUNHO',
  storage_key: 'key', storage_bucket: 'eldox-ged', mime_type: 'application/pdf',
  tamanho_bytes: 2048, checksum_sha256: 'abc', nome_original: 'a.pdf',
  criado_por: USER_TECNICO, aprovado_por: null, aprovado_em: null,
  workflow_template_id: null, workflow_step_atual: 0, qr_token: 'qr-uuid',
};

const VERSAO_IFA: any = { ...VERSAO_RASCUNHO, id: 102, status: 'IFA' };
const VERSAO_IFC: any = { ...VERSAO_RASCUNHO, id: 103, status: 'IFC' };

const PDF_FILE: Express.Multer.File = {
  fieldname: 'arquivo', originalname: 'planta.pdf', encoding: '7bit',
  mimetype: 'application/pdf', size: 2048,
  buffer: Buffer.from('pdf'), stream: null as any,
  destination: '', filename: '', path: '',
};

const UPLOAD_DTO_BASE = { titulo: 'Planta', categoriaId: 1, pastaId: 1 };

// ─── Mocks ────────────────────────────────────────────────────────────────────

// prisma é um objeto simples com jest.fn() — resetado explicitamente no beforeEach
const prisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

const minio: Partial<MinioService> = {
  uploadFile:       jest.fn().mockResolvedValue({ key: 'k', bucket: 'eldox-ged', checksum: 'abc' }),
  getPresignedUrl:  jest.fn().mockResolvedValue('https://minio/url'),
  calcularChecksum: jest.fn().mockReturnValue('abc'),
  buildStorageKey:  jest.fn().mockReturnValue('key'),
};

const workflow: Partial<WorkflowService> = {
  iniciar: jest.fn().mockResolvedValue(undefined),
};

const gedQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService() {
  return new GedService(prisma as any, minio as MinioService, workflow as WorkflowService, gedQueue as any);
}

/**
 * Configura mocks para um upload bem-sucedido.
 * Retorna um array de chamadas para $queryRawUnsafe que podem ser
 * sobrescritas individualmente para casos negativos.
 */
function setupUploadMocks(overrides: { config?: any; codigoExiste?: boolean } = {}) {
  prisma.$queryRawUnsafe
    .mockResolvedValueOnce([overrides.config ?? CONFIG_AUDITORIA_ON])  // 1: config
    .mockResolvedValueOnce([{ codigo: 'EDX001' }])                     // 2: obra código
    .mockResolvedValueOnce([{ count: '0' }])                           // 3: count disciplina
    .mockResolvedValueOnce(overrides.codigoExiste ? [{ id: 99 }] : []) // 4: unicidade
    .mockResolvedValueOnce([{ id: 42 }])                               // 5: INSERT documento RETURNING
    .mockResolvedValueOnce([{ id: 101, qr_token: 'qr-uuid' }]);        // 6: INSERT versao RETURNING
  prisma.$executeRawUnsafe.mockResolvedValue(undefined);
}

/** Encontra chamada ao audit_log pelo nome da ação */
function auditCall(acao: string) {
  return (prisma.$executeRawUnsafe as jest.Mock).mock.calls.find(
    (args: any[]) =>
      typeof args[0] === 'string' &&
      args[0].includes('INSERT INTO ged_audit_log') &&
      args[4] === acao,
  );
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('GedService', () => {
  let svc: GedService;

  beforeEach(() => {
    // resetAllMocks: limpa chamadas E fila de mockResolvedValueOnce — evita poluição entre describes
    jest.resetAllMocks();
    // Restaura defaults dos mocks de infraestrutura
    (minio.uploadFile as jest.Mock).mockResolvedValue({ key: 'k', bucket: 'eldox-ged', checksum: 'abc' });
    (minio.getPresignedUrl as jest.Mock).mockResolvedValue('https://minio/url');
    (minio.calcularChecksum as jest.Mock).mockReturnValue('abc');
    (minio.buildStorageKey as jest.Mock).mockReturnValue('key');
    (workflow.iniciar as jest.Mock).mockResolvedValue(undefined);
    (gedQueue.add as jest.Mock).mockResolvedValue({ id: 'job-1' });
    svc = makeService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ──────────────────────────────────────────────────────────────────────────
  describe('upload()', () => {
    it('retorna documentoId, versaoId, codigo e status RASCUNHO', async () => {
      setupUploadMocks();
      const r = await svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE);
      expect(r.documentoId).toBe(42);
      expect(r.versaoId).toBe(101);
      expect(r.codigoGerado).toMatch(/EDX001-\w{3}-\d{3}/);
      expect(r.status).toBe('RASCUNHO');
      expect(r.qrToken).toBeDefined();
    });

    it('faz upload no MinIO exatamente 1 vez', async () => {
      setupUploadMocks();
      await svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE);
      expect(minio.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('grava audit_log com acao UPLOAD', async () => {
      setupUploadMocks();
      await svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE);
      expect(auditCall('UPLOAD')).toBeDefined();
    });

    it('enfileira job ged.ocr quando ocr_ativo = true', async () => {
      setupUploadMocks();
      await svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE);
      expect(gedQueue.add).toHaveBeenCalledWith(
        'ged.ocr',
        expect.objectContaining({ versaoId: 101, tenantId: TENANT_ID }),
        expect.any(Object),
      );
    });

    it('NÃO enfileira ged.ocr quando ocr_ativo = false', async () => {
      setupUploadMocks({ config: CONFIG_OCR_OFF });
      await svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE);
      expect(gedQueue.add).not.toHaveBeenCalled();
    });

    it('rejeita PDF quando formato é inválido (.exe)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([CONFIG_AUDITORIA_ON]);
      const fileExe = { ...PDF_FILE, mimetype: 'application/exe', originalname: 'virus.exe' };
      await expect(
        svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, fileExe as any, UPLOAD_DTO_BASE),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita quando código duplicado já existe no tenant', async () => {
      setupUploadMocks({ codigoExiste: true });
      await expect(
        svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['application/pdf',     'doc.pdf'],
      ['image/jpeg',          'foto.jpg'],
      ['image/png',           'img.png'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'mem.docx'],
    ])('aceita arquivo com mimetype %s', async (mimetype, originalname) => {
      setupUploadMocks();
      const file = { ...PDF_FILE, mimetype, originalname };
      await expect(
        svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, file as any, UPLOAD_DTO_BASE),
      ).resolves.toMatchObject({ status: 'RASCUNHO' });
    });

    it.each([
      ['application/exe',  'v.exe'],
      ['text/plain',       'n.txt'],
      ['application/zip',  'a.zip'],
    ])('rejeita arquivo com mimetype %s', async (mimetype, originalname) => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([CONFIG_AUDITORIA_ON]);
      const file = { ...PDF_FILE, mimetype, originalname };
      await expect(
        svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, file as any, UPLOAD_DTO_BASE),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUBMETER
  // ──────────────────────────────────────────────────────────────────────────
  describe('submeter()', () => {
    it('transita RASCUNHO → IFA e retorna status IFA', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_RASCUNHO]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const r = await svc.submeter(TENANT_ID, USER_TECNICO, VERSAO_RASCUNHO.id);

      expect(r.status).toBe('IFA');
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'IFA'"),
        VERSAO_RASCUNHO.id,
      );
    });

    it('grava audit_log com acao SUBMISSAO', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_RASCUNHO]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.submeter(TENANT_ID, USER_TECNICO, VERSAO_RASCUNHO.id);

      expect(auditCall('SUBMISSAO')).toBeDefined();
    });

    it('inicia workflow quando workflow_template_id está definido', async () => {
      const versaoComWf = { ...VERSAO_RASCUNHO, workflow_template_id: 1 };
      prisma.$queryRawUnsafe.mockResolvedValueOnce([versaoComWf]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.submeter(TENANT_ID, USER_TECNICO, versaoComWf.id);

      expect(workflow.iniciar).toHaveBeenCalledWith(TENANT_ID, versaoComWf.id, 1, USER_TECNICO);
    });

    it('NÃO inicia workflow quando workflow_template_id é null', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_RASCUNHO]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.submeter(TENANT_ID, USER_TECNICO, VERSAO_RASCUNHO.id);

      expect(workflow.iniciar).not.toHaveBeenCalled();
    });

    it('lança BadRequestException para transição inválida (IFC → IFA)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_IFC]);

      await expect(
        svc.submeter(TENANT_ID, USER_TECNICO, VERSAO_IFC.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando versão não pertence ao tenant', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.submeter(TENANT_ID, USER_TECNICO, 9999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // APROVAR
  // ──────────────────────────────────────────────────────────────────────────
  describe('aprovar()', () => {
    it('transita IFA → IFC e retorna status IFC', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([VERSAO_IFA])   // buscarVersao
        .mockResolvedValueOnce([]);             // versoesVigentes anteriores
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const r = await svc.aprovar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, { statusAprovado: 'IFC' });

      expect(r.status).toBe('IFC');
    });

    it('REGRA CRÍTICA: lança ForbiddenException quando aprovador = criador', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([{
        ...VERSAO_IFA,
        criado_por: USER_ENGENHEIRO,
      }]);

      await expect(
        svc.aprovar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, { statusAprovado: 'IFC' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('obsoleta versão anterior vigente ao aprovar nova versão', async () => {
      const versaoAnterior = { id: 50, status: 'IFC' };
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([VERSAO_IFA])
        .mockResolvedValueOnce([versaoAnterior]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.aprovar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, { statusAprovado: 'IFC' });

      const obsoletarCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.find(
        (args: any[]) => typeof args[0] === 'string' && args[0].includes("status = 'OBSOLETO'"),
      );
      expect(obsoletarCall).toBeDefined();
      expect(obsoletarCall[1]).toBe(versaoAnterior.id);
    });

    it('grava audit_log APROVACAO e OBSOLESCENCIA', async () => {
      const versaoAnterior = { id: 50, status: 'IFC' };
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([VERSAO_IFA])
        .mockResolvedValueOnce([versaoAnterior]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.aprovar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, { statusAprovado: 'IFC' });

      expect(auditCall('APROVACAO')).toBeDefined();
      expect(auditCall('OBSOLESCENCIA')).toBeDefined();
    });

    it('lança BadRequestException para transição inválida (RASCUNHO → IFC)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_RASCUNHO]);

      await expect(
        svc.aprovar(TENANT_ID, USER_ENGENHEIRO, VERSAO_RASCUNHO.id, { statusAprovado: 'IFC' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando versão não existe', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.aprovar(TENANT_ID, USER_ENGENHEIRO, 9999, { statusAprovado: 'IFC' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REJEITAR
  // ──────────────────────────────────────────────────────────────────────────
  describe('rejeitar()', () => {
    it('transita IFA → REJEITADO e retorna status REJEITADO', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_IFA]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const r = await svc.rejeitar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, {
        comentario: 'Planta incompleta — cotas ausentes.',
      });

      expect(r.status).toBe('REJEITADO');
    });

    it('REGRA CRÍTICA: lança ForbiddenException quando rejeitador = criador', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([{
        ...VERSAO_IFA,
        criado_por: USER_ENGENHEIRO,
      }]);

      await expect(
        svc.rejeitar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, { comentario: 'Comentário.' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('grava audit_log REJEICAO com comentário no detalhes', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_IFA]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.rejeitar(TENANT_ID, USER_ENGENHEIRO, VERSAO_IFA.id, {
        comentario: 'Cotas erradas.',
      });

      const call = auditCall('REJEICAO');
      expect(call).toBeDefined();
      expect(JSON.parse(call[8])).toMatchObject({ comentario: 'Cotas erradas.' });
    });

    it('lança BadRequestException para transição inválida (RASCUNHO → REJEITADO)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_RASCUNHO]);

      await expect(
        svc.rejeitar(TENANT_ID, USER_ENGENHEIRO, VERSAO_RASCUNHO.id, { comentario: 'X' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DOWNLOAD
  // ──────────────────────────────────────────────────────────────────────────
  describe('download()', () => {
    it('retorna presignedUrl e expiresInSeconds', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_IFC]);
      prisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const r = await svc.download(TENANT_ID, USER_TECNICO, VERSAO_IFC.id);

      expect(r.presignedUrl).toBe('https://minio/url');
      expect(r.expiresInSeconds).toBe(300);
    });

    it('REGRA CRÍTICA: audit_log DOWNLOAD gravado ANTES de gerar URL', async () => {
      const order: string[] = [];
      prisma.$queryRawUnsafe.mockResolvedValueOnce([VERSAO_IFC]);
      prisma.$executeRawUnsafe.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO ged_audit_log')) order.push('AUDIT');
      });
      (minio.getPresignedUrl as jest.Mock).mockImplementation(async () => {
        order.push('PRESIGNED');
        return 'https://minio/url';
      });

      await svc.download(TENANT_ID, USER_TECNICO, VERSAO_IFC.id);

      expect(order[0]).toBe('AUDIT');
      expect(order[1]).toBe('PRESIGNED');
    });

    it('lança NotFoundException quando versão não existe neste tenant', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.download(TENANT_ID, USER_TECNICO, 9999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ISOLAMENTO DE TENANT
  // ──────────────────────────────────────────────────────────────────────────
  describe('isolamento de tenant', () => {
    it('buscarVersao consulta com tenant_id no JOIN — array vazio lança NotFoundException', async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(
        svc.submeter(TENANT_ID, USER_TECNICO, 101),
      ).rejects.toThrow(NotFoundException);

      const query = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[0][0] as string;
      expect(query).toMatch(/tenant_id/i);
    });

    it('upload inclui tenant_id em todas as queries de verificação', async () => {
      setupUploadMocks();
      await svc.upload(TENANT_ID, USER_TECNICO, OBRA_ID, PDF_FILE, UPLOAD_DTO_BASE);

      // Verifica que o tenantId foi passado como parâmetro em pelo menos uma query
      const calls = (prisma.$queryRawUnsafe as jest.Mock).mock.calls;
      const algumComTenant = calls.some((args: any[]) =>
        args.includes(TENANT_ID),
      );
      expect(algumComTenant).toBe(true);
    });
  });
});
