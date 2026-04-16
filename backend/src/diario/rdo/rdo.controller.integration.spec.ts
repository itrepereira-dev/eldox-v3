// src/diario/rdo/rdo.controller.integration.spec.ts
//
// Testes de integração HTTP do RdoController.
// Estratégia: módulo NestJS real (controller + pipes) com service/ia-service
// totalmente mockados via jest.fn(). Sem banco real, sem BullMQ real.
//
// Cobertura foco:
//   - Isolamento de tenant (tenantId vem do JWT, não do body)
//   - Validação de DTOs via ValidationPipe
//   - HTTP status codes corretos por rota

import {
  INestApplication,
  ValidationPipe,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');

import { RdoController } from './rdo.controller';
import { RdoService } from './rdo.service';
import { RdoIaService } from './rdo-ia.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const userTenant1 = { id: 1, tenantId: 1, role: 'ADMIN_TENANT' };
const userTenant2 = { id: 2, tenantId: 2, role: 'ADMIN_TENANT' };

const RDO_MOCK = {
  id: 10,
  tenantId: 1,
  obraId: 100,
  data: '2026-04-14',
  status: 'preenchendo',
};

const RDO_LIST_MOCK = {
  data: [RDO_MOCK],
  total: 1,
  page: 1,
  limit: 20,
};

// ─── Helper: MockJwtGuard factory ────────────────────────────────────────────
//
// Substitui JwtAuthGuard injetando o user mock diretamente no request.
// Cada describe cria o app com o user desejado.

function makeMockJwtGuard(user: typeof userTenant1) {
  class MockJwtGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
      const req = ctx.switchToHttp().getRequest();
      req.user = user;
      return true;
    }
  }
  return MockJwtGuard;
}

// ─── Mock do RdoService ───────────────────────────────────────────────────────

function makeMockRdoService() {
  return {
    create: jest.fn().mockResolvedValue({ ...RDO_MOCK }),
    list: jest.fn().mockResolvedValue(RDO_LIST_MOCK),
    findById: jest.fn().mockResolvedValue(RDO_MOCK),
    update: jest.fn().mockResolvedValue(RDO_MOCK),
    remove: jest.fn().mockResolvedValue(undefined),
    updateStatus: jest.fn().mockResolvedValue({ ...RDO_MOCK, status: 'revisao' }),
    upsertClima: jest.fn().mockResolvedValue({}),
    substituirMaoObra: jest.fn().mockResolvedValue({}),
    substituirEquipamentos: jest.fn().mockResolvedValue({}),
    substituirAtividades: jest.fn().mockResolvedValue({}),
    substituirOcorrencias: jest.fn().mockResolvedValue({}),
    substituirChecklist: jest.fn().mockResolvedValue({}),
    getInteligenciaObra: jest.fn().mockResolvedValue({}),
  };
}

// ─── Mock do RdoIaService ─────────────────────────────────────────────────────

function makeMockRdoIaService() {
  return {
    validarRdo: jest.fn().mockResolvedValue({ inconsistencias: [] }),
    registrarAcaoSugestao: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Factory do app de teste ──────────────────────────────────────────────────

async function buildApp(
  user: typeof userTenant1,
  rdoServiceOverride?: Partial<ReturnType<typeof makeMockRdoService>>,
) {
  const mockRdoService = { ...makeMockRdoService(), ...rdoServiceOverride };
  const mockRdoIaService = makeMockRdoIaService();
  const MockJwtGuard = makeMockJwtGuard(user);

  const module: TestingModule = await Test.createTestingModule({
    controllers: [RdoController],
    providers: [
      { provide: RdoService, useValue: mockRdoService },
      { provide: RdoIaService, useValue: mockRdoIaService },
      // Substitui JwtAuthGuard globalmente
      { provide: JwtAuthGuard, useClass: MockJwtGuard },
      // RolesGuard real — precisa do Reflector
      Reflector,
      {
        provide: RolesGuard,
        useFactory: (reflector: Reflector) => new RolesGuard(reflector),
        inject: [Reflector],
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(MockJwtGuard)
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  await app.init();

  return { app, mockRdoService, mockRdoIaService };
}

// =============================================================================
// Suite 1 — Isolamento de tenant (camada HTTP completa via supertest)
// =============================================================================

describe('RdoController — Isolamento de Tenant (HTTP)', () => {
  // ─── GET /api/v1/diario/rdos ───────────────────────────────────────────────

  describe('GET /api/v1/diario/rdos', () => {
    let app: INestApplication;
    let mockRdoService: ReturnType<typeof makeMockRdoService>;

    beforeEach(async () => {
      ({ app, mockRdoService } = await buildApp(userTenant1));
    });

    afterEach(async () => {
      await app.close();
    });

    it('retorna 400 quando obra_id não é fornecido', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/diario/rdos')
        .expect(400);
    });

    it('retorna 200 e chama rdoService.list com tenantId vindo do JWT', async () => {
      mockRdoService.list.mockResolvedValueOnce(RDO_LIST_MOCK);

      await request(app.getHttpServer())
        .get('/api/v1/diario/rdos?obra_id=100')
        .expect(200);

      // tenantId deve vir do JWT (1), não de parâmetro externo
      expect(mockRdoService.list).toHaveBeenCalledWith(
        userTenant1.tenantId,
        expect.objectContaining({ obra_id: 100 }),
      );
    });

    it('tenant A não vê RDOs do tenant B — tenantId vem do JWT, não do query', async () => {
      // Monta app com user do tenant 1
      const { app: appT1, mockRdoService: svcT1 } = await buildApp(userTenant1);
      // Monta app com user do tenant 2
      const { app: appT2, mockRdoService: svcT2 } = await buildApp(userTenant2);

      try {
        await request(appT1.getHttpServer())
          .get('/api/v1/diario/rdos?obra_id=100')
          .expect(200);

        await request(appT2.getHttpServer())
          .get('/api/v1/diario/rdos?obra_id=100')
          .expect(200);

        // Tenant 1 recebe tenantId=1 do JWT
        expect(svcT1.list).toHaveBeenCalledWith(1, expect.any(Object));
        // Tenant 2 recebe tenantId=2 do JWT
        expect(svcT2.list).toHaveBeenCalledWith(2, expect.any(Object));
        // Cada service é chamado exatamente uma vez — sem cross-tenant
        expect(svcT1.list).toHaveBeenCalledTimes(1);
        expect(svcT2.list).toHaveBeenCalledTimes(1);
      } finally {
        await appT1.close();
        await appT2.close();
      }
    });
  });

  // ─── POST /api/v1/diario/rdos ─────────────────────────────────────────────

  describe('POST /api/v1/diario/rdos', () => {
    let app: INestApplication;
    let mockRdoService: ReturnType<typeof makeMockRdoService>;

    beforeEach(async () => {
      ({ app, mockRdoService } = await buildApp(userTenant1));
    });

    afterEach(async () => {
      await app.close();
    });

    it('retorna 201 com rdo_id quando dto é válido', async () => {
      mockRdoService.create.mockResolvedValueOnce({ id: 10, status: 'preenchendo' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/diario/rdos')
        .send({ obra_id: 100, data: '2026-04-14' })
        .expect(201);

      expect(res.body).toHaveProperty('id', 10);
    });

    it('retorna 400 quando obra_id está ausente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/diario/rdos')
        .send({ data: '2026-04-14' })
        .expect(400);
    });

    it('retorna 400 quando data está ausente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/diario/rdos')
        .send({ obra_id: 100 })
        .expect(400);
    });

    it('retorna 400 quando data é inválida (não é ISO 8601)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/diario/rdos')
        .send({ obra_id: 100, data: 'não-é-data' })
        .expect(400);
    });

    it('passa tenantId e usuarioId do JWT para o service — não do body', async () => {
      mockRdoService.create.mockResolvedValueOnce({ id: 10 });

      await request(app.getHttpServer())
        .post('/api/v1/diario/rdos')
        .send({ obra_id: 100, data: '2026-04-14' })
        .expect(201);

      expect(mockRdoService.create).toHaveBeenCalledWith(
        userTenant1.tenantId,  // vem do JWT
        userTenant1.id,        // vem do JWT
        expect.objectContaining({ obra_id: 100, data: '2026-04-14' }),
      );
    });
  });

  // ─── PATCH /api/v1/diario/rdos/:id/status ────────────────────────────────

  describe('PATCH /api/v1/diario/rdos/:id/status', () => {
    let app: INestApplication;
    let mockRdoService: ReturnType<typeof makeMockRdoService>;

    beforeEach(async () => {
      ({ app, mockRdoService } = await buildApp(userTenant1));
    });

    afterEach(async () => {
      await app.close();
    });

    it('retorna 200 quando status=revisao', async () => {
      mockRdoService.updateStatus.mockResolvedValueOnce({ id: 10, status: 'revisao' });

      await request(app.getHttpServer())
        .patch('/api/v1/diario/rdos/10/status')
        .send({ status: 'revisao' })
        .expect(200);
    });

    it('retorna 400 quando status é inválido', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/diario/rdos/10/status')
        .send({ status: 'invalido' })
        .expect(400);
    });

    it('passa role do JWT para o service', async () => {
      mockRdoService.updateStatus.mockResolvedValueOnce({ id: 10, status: 'revisao' });

      await request(app.getHttpServer())
        .patch('/api/v1/diario/rdos/10/status')
        .send({ status: 'revisao' })
        .expect(200);

      expect(mockRdoService.updateStatus).toHaveBeenCalledWith(
        userTenant1.tenantId,
        userTenant1.id,
        userTenant1.role,  // role vem do JWT
        10,
        expect.objectContaining({ status: 'revisao' }),
      );
    });
  });

  // ─── DELETE /api/v1/diario/rdos/:id ──────────────────────────────────────

  describe('DELETE /api/v1/diario/rdos/:id', () => {
    let app: INestApplication;
    let mockRdoService: ReturnType<typeof makeMockRdoService>;

    beforeEach(async () => {
      ({ app, mockRdoService } = await buildApp(userTenant1));
    });

    afterEach(async () => {
      await app.close();
    });

    it('retorna 204 ao excluir com sucesso', async () => {
      mockRdoService.remove.mockResolvedValueOnce(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/diario/rdos/10')
        .expect(204);
    });

    it('passa tenantId do JWT — tenant B não pode excluir RDO do tenant A', async () => {
      // App do tenant 2 chama DELETE — tenantId=2 deve ir para o service
      const { app: appT2, mockRdoService: svcT2 } = await buildApp(userTenant2);
      try {
        svcT2.remove.mockResolvedValueOnce(undefined);

        await request(appT2.getHttpServer())
          .delete('/api/v1/diario/rdos/10')
          .expect(204);

        // O service recebe tenantId=2 (do JWT do tenant B), nunca tenantId=1
        expect(svcT2.remove).toHaveBeenCalledWith(
          userTenant2.tenantId,  // 2 — isolamento garantido
          userTenant2.id,
          userTenant2.role,
          10,
        );
        expect(svcT2.remove).not.toHaveBeenCalledWith(
          userTenant1.tenantId,  // 1 — NUNCA deve usar o tenantId errado
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      } finally {
        await appT2.close();
      }
    });
  });
});

// =============================================================================
// Suite 2 — Validação de DTOs (ValidationPipe)
// =============================================================================

describe('RdoController — Validação de DTOs', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildApp(userTenant1));
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /rdos sem obra_id → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/diario/rdos')
      .send({ data: '2026-04-14' })
      .expect(400);
  });

  it('POST /rdos sem data → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/diario/rdos')
      .send({ obra_id: 100 })
      .expect(400);
  });

  it('POST /rdos com data inválida ("não-é-data") → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/diario/rdos')
      .send({ obra_id: 100, data: 'não-é-data' })
      .expect(400);
  });

  it('PATCH /rdos/:id/status com status: "invalido" → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/diario/rdos/10/status')
      .send({ status: 'invalido' })
      .expect(400);
  });

  it('PATCH /rdos/:id/status com status ausente → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/diario/rdos/10/status')
      .send({})
      .expect(400);
  });

  it('GET /rdos com obra_id não numérico → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/diario/rdos?obra_id=abc')
      .expect(400);
  });
});

// =============================================================================
// Suite 3 — Rotas adicionais (findById, update, seções, IA)
// =============================================================================

describe('RdoController — Rotas adicionais', () => {
  let app: INestApplication;
  let mockRdoService: ReturnType<typeof makeMockRdoService>;
  let mockRdoIaService: ReturnType<typeof makeMockRdoIaService>;

  beforeEach(async () => {
    ({ app, mockRdoService, mockRdoIaService } = await buildApp(userTenant1));
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/diario/rdos/:id retorna 200 com o RDO', async () => {
    mockRdoService.findById.mockResolvedValueOnce(RDO_MOCK);

    const res = await request(app.getHttpServer())
      .get('/api/v1/diario/rdos/10')
      .expect(200);

    expect(mockRdoService.findById).toHaveBeenCalledWith(userTenant1.tenantId, 10);
    expect(res.body).toHaveProperty('id', 10);
  });

  it('POST /api/v1/diario/rdos/:id/validar retorna 200 com inconsistencias', async () => {
    mockRdoIaService.validarRdo.mockResolvedValueOnce({ inconsistencias: [] });

    const res = await request(app.getHttpServer())
      .post('/api/v1/diario/rdos/10/validar')
      .expect(200);

    expect(mockRdoIaService.validarRdo).toHaveBeenCalledWith(10, userTenant1.tenantId);
    expect(res.body).toHaveProperty('inconsistencias');
  });

  it('PATCH /api/v1/diario/rdos/:id/status com status=aprovado retorna 200', async () => {
    mockRdoService.updateStatus.mockResolvedValueOnce({ id: 10, status: 'aprovado' });

    const res = await request(app.getHttpServer())
      .patch('/api/v1/diario/rdos/10/status')
      .send({ status: 'aprovado' })
      .expect(200);

    expect(res.body).toHaveProperty('status', 'aprovado');
  });

  it('GET /api/v1/diario/obras/:obraId/inteligencia retorna 200', async () => {
    mockRdoService.getInteligenciaObra.mockResolvedValueOnce({ score: 0.9 });

    const res = await request(app.getHttpServer())
      .get('/api/v1/diario/obras/100/inteligencia')
      .expect(200);

    expect(mockRdoService.getInteligenciaObra).toHaveBeenCalledWith(userTenant1.tenantId, 100);
    expect(res.body).toHaveProperty('score');
  });

  it('PUT /api/v1/diario/rdos/:id/clima retorna 200', async () => {
    mockRdoService.upsertClima.mockResolvedValueOnce({ ok: true });

    const climaValido = {
      itens: [
        {
          periodo: 'manha',
          condicao: 'ensolarado',
          praticavel: true,
          aplicado_pelo_usuario: false,
        },
      ],
    };

    await request(app.getHttpServer())
      .put('/api/v1/diario/rdos/10/clima')
      .send(climaValido)
      .expect(200);

    expect(mockRdoService.upsertClima).toHaveBeenCalledWith(
      userTenant1.tenantId,
      userTenant1.id,
      10,
      expect.any(Object),
    );
  });

  it('tenantId nunca vaza entre requests — cada request usa tenantId do próprio JWT', async () => {
    // Dois requests seguidos no mesmo app (tenant1)
    await request(app.getHttpServer())
      .get('/api/v1/diario/rdos?obra_id=1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/diario/rdos?obra_id=2')
      .expect(200);

    // Ambas as chamadas devem usar tenantId=1 (do JWT mockado)
    const calls = mockRdoService.list.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(userTenant1.tenantId);
    expect(calls[1][0]).toBe(userTenant1.tenantId);
  });
});
