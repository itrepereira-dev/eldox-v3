import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// -------------------------------------------------------------------
// Mock global do bcryptjs — evita computação real de hash nos testes
// -------------------------------------------------------------------
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_senha'),
  compare: jest.fn(),
}));

// -------------------------------------------------------------------
// Fixtures reutilizáveis
// -------------------------------------------------------------------
const PLANO_MOCK = { id: 1, nome: 'starter' };

const TENANT_MOCK = {
  id: 10,
  nome: 'Empresa Teste',
  slug: 'empresa-teste',
  ativo: true,
  planoId: 1,
  plano: PLANO_MOCK,
};

const USUARIO_MOCK = {
  id: 100,
  nome: 'Admin Teste',
  email: 'admin@teste.com',
  senhaHash: 'hashed_senha',
  role: 'ADMIN_TENANT',
  tenantId: 10,
  ativo: true,
  deletadoEm: null,
};

const REGISTER_DTO = {
  tenantNome: 'Empresa Teste',
  tenantSlug: 'empresa-teste',
  adminNome: 'Admin Teste',
  adminEmail: 'admin@teste.com',
  adminSenha: 'senha1234',
};

const LOGIN_DTO = {
  slug: 'empresa-teste',
  email: 'admin@teste.com',
  senha: 'senha1234',
};

// -------------------------------------------------------------------
// Helpers para assertions de exceção (Jest 30 compatível)
// -------------------------------------------------------------------
async function expectToRejectWith<T>(
  promise: Promise<T>,
  ExceptionClass: new (...args: any[]) => Error,
  message: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Esperava que a Promise rejeitasse, mas ela resolveu.');
  } catch (err) {
    expect(err).toBeInstanceOf(ExceptionClass);
    expect((err as Error).message).toContain(message);
  }
}

// -------------------------------------------------------------------
// Suite principal
// -------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;

  // Mocks do Prisma
  let prisma: {
    tenant: { findUnique: jest.Mock; create: jest.Mock };
    usuario: { findFirst: jest.Mock };
    plano: { findUnique: jest.Mock };
  };

  // Mocks de infraestrutura
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    // Recria os mocks a cada teste para garantir isolamento total
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      usuario: {
        findFirst: jest.fn(),
      },
      plano: {
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('jwt_token_mock'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((_key: string, defaultValue?: string) => defaultValue ?? null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reseta spies do bcrypt antes de cada teste
    (bcrypt.compare as jest.Mock).mockReset();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_senha');
  });

  // =================================================================
  // register()
  // =================================================================
  describe('register', () => {
    it('happy path: deve registrar tenant + admin e retornar token e refreshToken', async () => {
      // Arrange — sem colisões, plano encontrado
      prisma.tenant.findUnique.mockResolvedValueOnce(null); // slug livre
      prisma.usuario.findFirst.mockResolvedValueOnce(null); // email livre
      prisma.plano.findUnique.mockResolvedValueOnce(PLANO_MOCK);

      const tenantCriado = { ...TENANT_MOCK, usuarios: [USUARIO_MOCK] };
      prisma.tenant.create.mockResolvedValueOnce(tenantCriado);

      // Act
      const result = await service.register(REGISTER_DTO);

      // Assert — estrutura de retorno
      expect(result).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        tenantSlug: TENANT_MOCK.slug,
        usuario: {
          id: USUARIO_MOCK.id,
          nome: USUARIO_MOCK.nome,
          email: USUARIO_MOCK.email,
          role: USUARIO_MOCK.role,
        },
      });

      // Assert — chamadas ao Prisma na ordem esperada
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { slug: REGISTER_DTO.tenantSlug } });
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith({ where: { email: REGISTER_DTO.adminEmail } });
      expect(prisma.plano.findUnique).toHaveBeenCalledWith({ where: { nome: 'starter' } });
      expect(prisma.tenant.create).toHaveBeenCalledTimes(1);

      // Assert — senha hasheada antes de persistir
      expect(bcrypt.hash).toHaveBeenCalledWith(REGISTER_DTO.adminSenha, 12);

      // Assert — dois tokens gerados (access + refresh)
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('slug duplicado: deve lançar ConflictException', async () => {
      // Arrange — slug já cadastrado
      prisma.tenant.findUnique.mockResolvedValueOnce(TENANT_MOCK);

      // Act & Assert
      await expectToRejectWith(
        service.register(REGISTER_DTO),
        ConflictException,
        'Slug já está em uso',
      );

      // Não deve avançar para verificar email ou criar tenant
      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('email duplicado: deve lançar ConflictException', async () => {
      // Arrange — slug livre, email já cadastrado
      prisma.tenant.findUnique.mockResolvedValueOnce(null);
      prisma.usuario.findFirst.mockResolvedValueOnce(USUARIO_MOCK);

      // Act & Assert
      await expectToRejectWith(
        service.register(REGISTER_DTO),
        ConflictException,
        'E-mail já está em uso',
      );

      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('plano starter não encontrado: deve lançar Error', async () => {
      // Arrange — sem colisões, mas plano ausente (seed não rodou)
      prisma.tenant.findUnique.mockResolvedValueOnce(null);
      prisma.usuario.findFirst.mockResolvedValueOnce(null);
      prisma.plano.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expectToRejectWith(
        service.register(REGISTER_DTO),
        Error,
        'Plano starter não encontrado — execute o seed',
      );

      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  // =================================================================
  // login()
  // =================================================================
  describe('login', () => {
    it('happy path: deve retornar token, refreshToken e dados do usuário', async () => {
      // Arrange
      prisma.tenant.findUnique.mockResolvedValueOnce(TENANT_MOCK);
      prisma.usuario.findFirst.mockResolvedValueOnce(USUARIO_MOCK);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      // Act
      const result = await service.login(LOGIN_DTO);

      // Assert — estrutura de retorno
      expect(result).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        tenantSlug: TENANT_MOCK.slug,
        usuario: {
          id: USUARIO_MOCK.id,
          nome: USUARIO_MOCK.nome,
          email: USUARIO_MOCK.email,
          role: USUARIO_MOCK.role,
        },
      });

      // Assert — Prisma chamado com parâmetros corretos
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: LOGIN_DTO.slug },
        include: { plano: true },
      });
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_MOCK.id,
          email: LOGIN_DTO.email,
          ativo: true,
          deletadoEm: null,
        },
      });

      // Assert — bcrypt.compare chamado com senha e hash corretos
      expect(bcrypt.compare).toHaveBeenCalledWith(LOGIN_DTO.senha, USUARIO_MOCK.senhaHash);

      // Assert — dois tokens gerados (access + refresh)
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('tenant não encontrado: deve lançar UnauthorizedException', async () => {
      // Arrange — tenant inexistente
      prisma.tenant.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expectToRejectWith(
        service.login(LOGIN_DTO),
        UnauthorizedException,
        'Tenant não encontrado ou inativo',
      );

      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    });

    it('tenant inativo: deve lançar UnauthorizedException', async () => {
      // Arrange — tenant existe mas está inativo
      prisma.tenant.findUnique.mockResolvedValueOnce({ ...TENANT_MOCK, ativo: false });

      // Act & Assert
      await expectToRejectWith(
        service.login(LOGIN_DTO),
        UnauthorizedException,
        'Tenant não encontrado ou inativo',
      );

      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    });

    it('usuário não encontrado no tenant: deve lançar UnauthorizedException', async () => {
      // Arrange — tenant ok, usuário não existe naquele tenant
      prisma.tenant.findUnique.mockResolvedValueOnce(TENANT_MOCK);
      prisma.usuario.findFirst.mockResolvedValueOnce(null);

      // Act & Assert
      await expectToRejectWith(
        service.login(LOGIN_DTO),
        UnauthorizedException,
        'Credenciais inválidas',
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('senha inválida: deve lançar UnauthorizedException', async () => {
      // Arrange — tenant ok, usuário ok, mas senha errada
      prisma.tenant.findUnique.mockResolvedValueOnce(TENANT_MOCK);
      prisma.usuario.findFirst.mockResolvedValueOnce(USUARIO_MOCK);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      // Act & Assert
      await expectToRejectWith(
        service.login(LOGIN_DTO),
        UnauthorizedException,
        'Credenciais inválidas',
      );

      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });
});
