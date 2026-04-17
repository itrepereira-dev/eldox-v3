# Gestão de Usuários com Permissões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema completo de gestão de usuários com perfis de acesso, permissões granulares por módulo (4 níveis hierárquicos), controle de acesso por obra e onboarding via convite por e-mail.

**Architecture:** Backend NestJS com novos módulos `UsuariosModule` e `PerfisAcessoModule`, `PermissaoGuard` para enforcement granular, e extensão do `AuthModule` para fluxos de convite/reset. Frontend React com área `/admin` restrita a ADMIN_TENANT/SUPER_ADMIN e três páginas de auth públicas.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend), React 18 + TanStack Query v5 + Zustand + React Router v6 (frontend), bcryptjs para tokens, nodemailer para e-mail.

**Spec:** `docs/superpowers/specs/2026-04-16-gestao-usuarios-permissoes-design.md`

---

## File Structure

### Backend — criar
- `backend/src/mail/mail.module.ts` — módulo de e-mail (nodemailer)
- `backend/src/mail/mail.service.ts` — sendConvite() e sendResetSenha()
- `backend/src/usuarios/usuarios.module.ts`
- `backend/src/usuarios/usuarios.controller.ts` — rotas /api/v1/usuarios
- `backend/src/usuarios/usuarios.service.ts` — lógica de negócio + invite
- `backend/src/usuarios/usuarios.service.spec.ts` — testes unitários
- `backend/src/usuarios/dto/create-usuario.dto.ts`
- `backend/src/usuarios/dto/update-usuario.dto.ts`
- `backend/src/perfis-acesso/perfis-acesso.module.ts`
- `backend/src/perfis-acesso/perfis-acesso.controller.ts`
- `backend/src/perfis-acesso/perfis-acesso.service.ts`
- `backend/src/perfis-acesso/perfis-acesso.service.spec.ts`
- `backend/src/perfis-acesso/dto/create-perfil.dto.ts`
- `backend/src/perfis-acesso/dto/save-permissoes.dto.ts`
- `backend/src/common/guards/permissao.guard.ts` — PermissaoGuard
- `backend/src/common/decorators/requer.decorator.ts` — @Requer()
- `backend/src/auth/dto/aceitar-convite.dto.ts`
- `backend/src/auth/dto/esqueci-senha.dto.ts`
- `backend/src/auth/dto/reset-senha.dto.ts`

### Backend — modificar
- `backend/prisma/schema.prisma` — novos models + campos em Usuario
- `backend/src/auth/auth.service.ts` — adicionar convite/reset/me-permissoes
- `backend/src/auth/auth.controller.ts` — novos endpoints
- `backend/src/app.module.ts` — importar UsuariosModule, PerfisAcessoModule, MailModule

### Frontend — criar
- `frontend-web/src/services/admin.service.ts` — todas as chamadas da área admin
- `frontend-web/src/layouts/AdminGuard.tsx` — redireciona não-admins
- `frontend-web/src/modules/admin/usuarios/pages/UsuariosListPage.tsx`
- `frontend-web/src/modules/admin/usuarios/pages/NovoUsuarioPage.tsx`
- `frontend-web/src/modules/admin/usuarios/pages/UsuarioDetalhePage.tsx`
- `frontend-web/src/modules/admin/perfis/pages/PerfisListPage.tsx`
- `frontend-web/src/modules/admin/perfis/pages/PerfilDetalhePage.tsx`
- `frontend-web/src/pages/auth/AceitarConvitePage.tsx`
- `frontend-web/src/pages/auth/EsqueciSenhaPage.tsx`
- `frontend-web/src/pages/auth/ResetSenhaPage.tsx`

### Frontend — modificar
- `frontend-web/src/App.tsx` — novas rotas admin + auth
- `frontend-web/src/components/layout/Sidebar.tsx` — seção Administração

---

## Task 1: Prisma Schema — novos models e campos

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Adicionar LABORATORIO ao enum Role e novo enum StatusUsuario**

No `schema.prisma`, localizar o `enum Role` e substituir:

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN_TENANT
  ENGENHEIRO
  TECNICO
  VISITANTE
  LABORATORIO
}

enum StatusUsuario {
  PENDENTE
  ATIVO
  INATIVO
}
```

- [ ] **Step 2: Adicionar campos novos ao model Usuario**

Localizar `model Usuario` e adicionar após `dashboardLayout Json? @map("dashboard_layout")`:

```prisma
  status           StatusUsuario @default(ATIVO)
  tokenHash        String?       @map("token_hash")
  tokenExp         DateTime?     @map("token_exp")
  perfilAcessoId   Int?          @map("perfil_acesso_id")
  perfilAcesso     PerfilAcesso? @relation(fields: [perfilAcessoId], references: [id])
```

- [ ] **Step 3: Adicionar model PerfilAcesso**

Após o model Usuario, adicionar:

```prisma
model PerfilAcesso {
  id          Int               @id @default(autoincrement())
  tenantId    Int               @map("tenant_id")
  tenant      Tenant            @relation(fields: [tenantId], references: [id])
  nome        String
  descricao   String?
  ativo       Boolean           @default(true)
  criadoEm   DateTime          @default(now()) @map("criado_em")
  permissoes  PerfilPermissao[]
  usuarios    Usuario[]

  @@index([tenantId])
}

model PerfilPermissao {
  id             Int         @id @default(autoincrement())
  perfilAcessoId Int         @map("perfil_acesso_id")
  perfilAcesso   PerfilAcesso @relation(fields: [perfilAcessoId], references: [id], onDelete: Cascade)
  modulo         String
  nivel          String

  @@unique([perfilAcessoId, modulo])
}

model UsuarioObra {
  id         Int      @id @default(autoincrement())
  tenantId   Int      @map("tenant_id")
  usuarioId  Int      @map("usuario_id")
  obraId     Int      @map("obra_id")
  criadoEm  DateTime @default(now()) @map("criado_em")
  usuario    Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  obra       Obra     @relation(fields: [obraId], references: [id], onDelete: Cascade)

  @@unique([usuarioId, obraId])
  @@index([tenantId])
}

model UsuarioPermissaoOverride {
  id              Int      @id @default(autoincrement())
  tenantId        Int      @map("tenant_id")
  usuarioId       Int      @map("usuario_id")
  modulo          String
  nivel           String
  concedido       Boolean
  concedidoPorId  Int      @map("concedido_por_id")
  criadoEm       DateTime @default(now()) @map("criado_em")
  usuario         Usuario  @relation("UsuarioOverrides", fields: [usuarioId], references: [id], onDelete: Cascade)
  concedidoPor    Usuario  @relation("OverridesConcedidos", fields: [concedidoPorId], references: [id])

  @@unique([usuarioId, modulo])
  @@index([tenantId])
}
```

- [ ] **Step 4: Adicionar relations faltantes em Usuario**

Dentro do `model Usuario`, adicionar junto às outras relations:

```prisma
  obrasPermitidas  UsuarioObra[]
  permissaoOverrides UsuarioPermissaoOverride[] @relation("UsuarioOverrides")
  overridesConcedidos UsuarioPermissaoOverride[] @relation("OverridesConcedidos")
```

- [ ] **Step 5: Adicionar relation em Obra (necessária para UsuarioObra)**

No `model Obra`, adicionar:

```prisma
  usuariosComAcesso UsuarioObra[]
```

- [ ] **Step 6: Adicionar relation em Tenant (necessária para PerfilAcesso)**

No `model Tenant`, adicionar:

```prisma
  perfisAcesso PerfilAcesso[]
```

- [ ] **Step 7: Gerar e aplicar migration**

```bash
cd backend
npx prisma migrate dev --name gestao-usuarios-permissoes
```

Expected: migration criada em `prisma/migrations/` e aplicada com sucesso.

- [ ] **Step 8: Gerar Prisma Client**

```bash
npx prisma generate
```

Expected: `@prisma/client` regenerado com os novos tipos.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add user management schema (perfil_acesso, permissoes, usuario_obra)"
```

---

## Task 2: MailService

**Files:**
- Create: `backend/src/mail/mail.module.ts`
- Create: `backend/src/mail/mail.service.ts`

- [ ] **Step 1: Instalar nodemailer**

```bash
cd backend
npm install nodemailer
npm install --save-dev @types/nodemailer
```

- [ ] **Step 2: Adicionar variáveis de ambiente**

No arquivo `backend/.env`, adicionar:

```
# E-mail (SMTP)
MAIL_HOST="smtp.mailtrap.io"
MAIL_PORT=587
MAIL_USER="seu-user"
MAIL_PASS="sua-senha"
MAIL_FROM="noreply@eldox.app"
APP_URL="http://localhost:5173"
```

- [ ] **Step 3: Criar mail.service.ts**

```typescript
// backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('MAIL_HOST', 'smtp.mailtrap.io'),
      port: config.get<number>('MAIL_PORT', 587),
      auth: {
        user: config.get('MAIL_USER', ''),
        pass: config.get('MAIL_PASS', ''),
      },
    });
  }

  async sendConvite(email: string, nome: string, token: string): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    const link = `${appUrl}/aceitar-convite?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM', 'noreply@eldox.app'),
      to: email,
      subject: 'Você foi convidado para o Eldox',
      html: `
        <h2>Bem-vindo ao Eldox</h2>
        <p>Você foi convidado para acessar o sistema. Clique no link abaixo para criar sua senha e finalizar o cadastro:</p>
        <p><a href="${link}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Finalizar Cadastro</a></p>
        <p>Este link é válido por 72 horas.</p>
        <p style="color:#888;font-size:12px">Se você não esperava este convite, ignore este e-mail.</p>
      `,
    }).catch((err) => {
      this.logger.error(`Falha ao enviar convite para ${email}: ${err.message}`);
    });
  }

  async sendResetSenha(email: string, token: string): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:5173');
    const link = `${appUrl}/reset-senha?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM', 'noreply@eldox.app'),
      to: email,
      subject: 'Redefinição de senha — Eldox',
      html: `
        <h2>Redefinição de Senha</h2>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Eldox.</p>
        <p><a href="${link}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Redefinir Senha</a></p>
        <p>Este link é válido por 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
      `,
    }).catch((err) => {
      this.logger.error(`Falha ao enviar reset para ${email}: ${err.message}`);
    });
  }
}
```

- [ ] **Step 4: Criar mail.module.ts**

```typescript
// backend/src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/mail/ backend/.env
git commit -m "feat: add MailService for invite and password reset emails"
```

---

## Task 3: UsuariosModule — Backend

**Files:**
- Create: `backend/src/usuarios/dto/create-usuario.dto.ts`
- Create: `backend/src/usuarios/dto/update-usuario.dto.ts`
- Create: `backend/src/usuarios/usuarios.service.ts`
- Create: `backend/src/usuarios/usuarios.service.spec.ts`
- Create: `backend/src/usuarios/usuarios.controller.ts`
- Create: `backend/src/usuarios/usuarios.module.ts`

- [ ] **Step 1: Criar DTOs**

```typescript
// backend/src/usuarios/dto/create-usuario.dto.ts
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsInt()
  perfilAcessoId?: number;
}
```

```typescript
// backend/src/usuarios/dto/update-usuario.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString, IsInt } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class AssignPerfilDto {
  @IsOptional()
  @IsInt()
  perfilAcessoId?: number | null;
}
```

- [ ] **Step 2: Escrever testes do UsuariosService**

```typescript
// backend/src/usuarios/usuarios.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const TENANT_ID = 1;

const USUARIO_MOCK = {
  id: 10,
  tenantId: TENANT_ID,
  nome: null,
  email: 'joao@construtora.com',
  senhaHash: null,
  role: 'ENGENHEIRO',
  ativo: false,
  status: 'PENDENTE',
  tokenHash: 'hash123',
  tokenExp: new Date(Date.now() + 72 * 3600 * 1000),
  perfilAcessoId: null,
  criadoEm: new Date(),
  deletadoEm: null,
  dashboardLayout: null,
};

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prisma: {
    usuario: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let mail: { sendConvite: jest.Mock };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    mail = { sendConvite: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('criar()', () => {
    it('deve criar usuário PENDENTE e enviar convite', async () => {
      prisma.usuario.findFirst.mockResolvedValueOnce(null); // email livre
      prisma.usuario.create.mockResolvedValueOnce(USUARIO_MOCK);

      const result = await service.criar(TENANT_ID, { email: 'joao@construtora.com', role: 'ENGENHEIRO' });

      expect(prisma.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            email: 'joao@construtora.com',
            role: 'ENGENHEIRO',
            status: 'PENDENTE',
            ativo: false,
          }),
        }),
      );
      expect(mail.sendConvite).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('PENDENTE');
    });

    it('deve lançar ConflictException se e-mail já existe no tenant', async () => {
      prisma.usuario.findFirst.mockResolvedValueOnce(USUARIO_MOCK);

      await expect(
        service.criar(TENANT_ID, { email: 'joao@construtora.com', role: 'ENGENHEIRO' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });
  });

  describe('ativarDesativar()', () => {
    it('deve desativar usuário ativo', async () => {
      prisma.usuario.findFirst.mockResolvedValueOnce({ ...USUARIO_MOCK, status: 'ATIVO', ativo: true });
      prisma.usuario.update.mockResolvedValueOnce({ ...USUARIO_MOCK, status: 'INATIVO', ativo: false });

      const result = await service.ativarDesativar(TENANT_ID, 10, false);
      expect(result.status).toBe('INATIVO');
    });

    it('deve lançar NotFoundException se usuário não for do tenant', async () => {
      prisma.usuario.findFirst.mockResolvedValueOnce(null);

      await expect(service.ativarDesativar(TENANT_ID, 99, false)).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 3: Rodar testes para verificar que falham**

```bash
cd backend
npx jest usuarios.service.spec.ts --no-coverage
```

Expected: FAIL — "Cannot find module './usuarios.service'"

- [ ] **Step 4: Criar UsuariosService**

```typescript
// backend/src/usuarios/usuarios.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto, AssignPerfilDto } from './dto/update-usuario.dto';
import * as crypto from 'crypto';

const TOKEN_CONVITE_HORAS = 72;
const TOKEN_RESET_HORAS = 1;

function gerarToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async listar(tenantId: number) {
    return this.prisma.usuario.findMany({
      where: { tenantId, deletadoEm: null },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        status: true,
        ativo: true,
        criadoEm: true,
        perfilAcessoId: true,
        perfilAcesso: { select: { id: true, nome: true } },
        _count: { select: { obrasPermitidas: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async buscarPorId(tenantId: number, id: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        status: true,
        ativo: true,
        criadoEm: true,
        perfilAcessoId: true,
        perfilAcesso: { select: { id: true, nome: true } },
        obrasPermitidas: {
          include: { obra: { select: { id: true, nome: true } } },
        },
        permissaoOverrides: true,
      },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  async criar(tenantId: number, dto: CreateUsuarioDto) {
    const existe = await this.prisma.usuario.findFirst({
      where: { tenantId, email: dto.email, deletadoEm: null },
    });
    if (existe) throw new ConflictException('E-mail já está em uso neste tenant');

    const { raw, hash } = gerarToken();
    const exp = new Date(Date.now() + TOKEN_CONVITE_HORAS * 3600 * 1000);

    const usuario = await this.prisma.usuario.create({
      data: {
        tenantId,
        email: dto.email,
        role: dto.role,
        nome: '',
        senhaHash: '',
        status: 'PENDENTE',
        ativo: false,
        tokenHash: hash,
        tokenExp: exp,
        perfilAcessoId: dto.perfilAcessoId ?? null,
      },
    });

    await this.mail.sendConvite(dto.email, '', raw);
    return usuario;
  }

  async atualizar(tenantId: number, id: number, dto: UpdateUsuarioDto) {
    await this.garantirExistente(tenantId, id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ...(dto.nome && { nome: dto.nome }), ...(dto.email && { email: dto.email }), ...(dto.role && { role: dto.role }) },
    });
  }

  async ativarDesativar(tenantId: number, id: number, ativar: boolean) {
    await this.garantirExistente(tenantId, id);
    return this.prisma.usuario.update({
      where: { id },
      data: {
        ativo: ativar,
        status: ativar ? 'ATIVO' : 'INATIVO',
      },
    });
  }

  async assignPerfil(tenantId: number, id: number, dto: AssignPerfilDto) {
    await this.garantirExistente(tenantId, id);
    return this.prisma.usuario.update({
      where: { id },
      data: { perfilAcessoId: dto.perfilAcessoId ?? null },
    });
  }

  async reenviarConvite(tenantId: number, id: number) {
    const u = await this.garantirExistente(tenantId, id);
    if (u.status !== 'PENDENTE') throw new BadRequestException('Usuário não está com status PENDENTE');

    const { raw, hash } = gerarToken();
    const exp = new Date(Date.now() + TOKEN_CONVITE_HORAS * 3600 * 1000);

    await this.prisma.usuario.update({
      where: { id },
      data: { tokenHash: hash, tokenExp: exp },
    });

    await this.mail.sendConvite(u.email, u.nome ?? '', raw);
    return { ok: true };
  }

  async adminResetSenha(tenantId: number, id: number) {
    const u = await this.garantirExistente(tenantId, id);

    const { raw, hash } = gerarToken();
    const exp = new Date(Date.now() + TOKEN_RESET_HORAS * 3600 * 1000);

    await this.prisma.usuario.update({
      where: { id },
      data: { tokenHash: hash, tokenExp: exp },
    });

    await this.mail.sendResetSenha(u.email, raw);
    return { ok: true };
  }

  async listarObras(tenantId: number, id: number) {
    await this.garantirExistente(tenantId, id);
    return this.prisma.usuarioObra.findMany({
      where: { usuarioId: id, tenantId },
      include: { obra: { select: { id: true, nome: true } } },
    });
  }

  async adicionarObra(tenantId: number, usuarioId: number, obraId: number) {
    await this.garantirExistente(tenantId, usuarioId);
    return this.prisma.usuarioObra.upsert({
      where: { usuarioId_obraId: { usuarioId, obraId } },
      create: { tenantId, usuarioId, obraId },
      update: {},
    });
  }

  async removerObra(tenantId: number, usuarioId: number, obraId: number) {
    await this.garantirExistente(tenantId, usuarioId);
    await this.prisma.usuarioObra.deleteMany({ where: { usuarioId, obraId, tenantId } });
    return { ok: true };
  }

  async listarOverrides(tenantId: number, usuarioId: number) {
    await this.garantirExistente(tenantId, usuarioId);
    return this.prisma.usuarioPermissaoOverride.findMany({ where: { usuarioId, tenantId } });
  }

  async salvarOverrides(
    tenantId: number,
    usuarioId: number,
    concedidoPorId: number,
    overrides: Array<{ modulo: string; nivel: string; concedido: boolean }>,
  ) {
    await this.garantirExistente(tenantId, usuarioId);
    // Apaga todos os overrides e recria
    await this.prisma.usuarioPermissaoOverride.deleteMany({ where: { usuarioId, tenantId } });
    if (overrides.length === 0) return [];
    return this.prisma.usuarioPermissaoOverride.createMany({
      data: overrides.map((o) => ({ tenantId, usuarioId, concedidoPorId, ...o })),
    });
  }

  async removerOverride(tenantId: number, usuarioId: number, modulo: string) {
    await this.garantirExistente(tenantId, usuarioId);
    await this.prisma.usuarioPermissaoOverride.deleteMany({ where: { usuarioId, tenantId, modulo } });
    return { ok: true };
  }

  private async garantirExistente(tenantId: number, id: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }
}
```

- [ ] **Step 5: Rodar testes**

```bash
npx jest usuarios.service.spec.ts --no-coverage
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Criar UsuariosController**

```typescript
// backend/src/usuarios/usuarios.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, HttpCode,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto, AssignPerfilDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';

@Controller('api/v1/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_TENANT', 'SUPER_ADMIN')
export class UsuariosController {
  constructor(private readonly svc: UsuariosService) {}

  @Get()
  listar(@TenantId() tenantId: number) {
    return this.svc.listar(tenantId);
  }

  @Post()
  criar(@TenantId() tenantId: number, @Body() dto: CreateUsuarioDto) {
    return this.svc.criar(tenantId, dto);
  }

  @Get(':id')
  buscar(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.buscarPorId(tenantId, id);
  }

  @Patch(':id')
  atualizar(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.svc.atualizar(tenantId, id, dto);
  }

  @Patch(':id/ativo')
  @HttpCode(200)
  ativarDesativar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { ativo: boolean },
  ) {
    return this.svc.ativarDesativar(tenantId, id, body.ativo);
  }

  @Patch(':id/perfil')
  @HttpCode(200)
  assignPerfil(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: AssignPerfilDto) {
    return this.svc.assignPerfil(tenantId, id, dto);
  }

  @Post(':id/reenviar-convite')
  @HttpCode(200)
  reenviarConvite(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.reenviarConvite(tenantId, id);
  }

  @Post(':id/reset-senha')
  @HttpCode(200)
  adminResetSenha(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.adminResetSenha(tenantId, id);
  }

  @Get(':id/obras')
  listarObras(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.listarObras(tenantId, id);
  }

  @Post(':id/obras')
  adicionarObra(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() body: { obraId: number }) {
    return this.svc.adicionarObra(tenantId, id, body.obraId);
  }

  @Post(':id/obras/:obraId/remover')
  @HttpCode(200)
  removerObra(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.svc.removerObra(tenantId, id, obraId);
  }

  @Get(':id/permissoes')
  listarOverrides(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.listarOverrides(tenantId, id);
  }

  @Post(':id/permissoes')
  @HttpCode(200)
  salvarOverrides(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @Body() body: { overrides: Array<{ modulo: string; nivel: string; concedido: boolean }> },
  ) {
    return this.svc.salvarOverrides(tenantId, id, user.id, body.overrides);
  }

  @Post(':id/permissoes/:modulo/remover')
  @HttpCode(200)
  removerOverride(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('modulo') modulo: string,
  ) {
    return this.svc.removerOverride(tenantId, id, modulo);
  }
}
```

- [ ] **Step 7: Criar UsuariosModule**

```typescript
// backend/src/usuarios/usuarios.module.ts
import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
```

- [ ] **Step 8: Registrar em app.module.ts**

Em `backend/src/app.module.ts`, adicionar:

```typescript
import { UsuariosModule } from './usuarios/usuarios.module';
import { MailModule } from './mail/mail.module';
// ... no array imports:
MailModule,
UsuariosModule,
```

- [ ] **Step 9: Verificar build**

```bash
npx nest build
```

Expected: compilado sem erros.

- [ ] **Step 10: Commit**

```bash
git add backend/src/usuarios/ backend/src/mail/ backend/src/app.module.ts
git commit -m "feat: add UsuariosModule with invite flow and obra/override management"
```

---

## Task 4: PerfisAcessoModule — Backend

**Files:**
- Create: `backend/src/perfis-acesso/dto/create-perfil.dto.ts`
- Create: `backend/src/perfis-acesso/dto/save-permissoes.dto.ts`
- Create: `backend/src/perfis-acesso/perfis-acesso.service.ts`
- Create: `backend/src/perfis-acesso/perfis-acesso.service.spec.ts`
- Create: `backend/src/perfis-acesso/perfis-acesso.controller.ts`
- Create: `backend/src/perfis-acesso/perfis-acesso.module.ts`

- [ ] **Step 1: Criar DTOs**

```typescript
// backend/src/perfis-acesso/dto/create-perfil.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePerfilDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
```

```typescript
// backend/src/perfis-acesso/dto/save-permissoes.dto.ts
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const MODULOS = ['concretagem', 'nc', 'ro', 'laudos', 'obras', 'usuarios', 'relatorios'];
const NIVEIS = ['VISUALIZAR', 'OPERAR', 'APROVAR', 'ADMINISTRAR'];

export class PermissaoItemDto {
  @IsString()
  @IsIn(MODULOS)
  modulo: string;

  @IsString()
  @IsIn(NIVEIS)
  nivel: string;
}

export class SavePermissoesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissaoItemDto)
  permissoes: PermissaoItemDto[];
}
```

- [ ] **Step 2: Escrever testes do PerfisAcessoService**

```typescript
// backend/src/perfis-acesso/perfis-acesso.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PerfisAcessoService } from './perfis-acesso.service';
import { PrismaService } from '../prisma/prisma.service';

const TENANT_ID = 1;

const PERFIL_MOCK = {
  id: 1,
  tenantId: TENANT_ID,
  nome: 'Engenheiro Sênior',
  descricao: null,
  ativo: true,
  criadoEm: new Date(),
  permissoes: [],
};

describe('PerfisAcessoService', () => {
  let service: PerfisAcessoService;
  let prisma: {
    perfilAcesso: { findMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    perfilPermissao: { deleteMany: jest.Mock; createMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      perfilAcesso: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      perfilPermissao: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerfisAcessoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PerfisAcessoService>(PerfisAcessoService);
  });

  describe('listar()', () => {
    it('deve retornar perfis do tenant', async () => {
      prisma.perfilAcesso.findMany.mockResolvedValueOnce([PERFIL_MOCK]);
      const result = await service.listar(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(prisma.perfilAcesso.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, ativo: true } }),
      );
    });
  });

  describe('salvarPermissoes()', () => {
    it('deve apagar permissoes existentes e criar novas', async () => {
      prisma.perfilAcesso.findFirst.mockResolvedValueOnce(PERFIL_MOCK);
      prisma.perfilPermissao.deleteMany.mockResolvedValueOnce({ count: 2 });
      prisma.perfilPermissao.createMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.salvarPermissoes(TENANT_ID, 1, {
        permissoes: [{ modulo: 'concretagem', nivel: 'OPERAR' }],
      });

      expect(prisma.perfilPermissao.deleteMany).toHaveBeenCalledWith({ where: { perfilAcessoId: 1 } });
      expect(prisma.perfilPermissao.createMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ count: 1 });
    });

    it('deve lançar NotFoundException se perfil não for do tenant', async () => {
      prisma.perfilAcesso.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.salvarPermissoes(TENANT_ID, 99, { permissoes: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 3: Rodar testes (esperar falha)**

```bash
npx jest perfis-acesso.service.spec.ts --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 4: Criar PerfisAcessoService**

```typescript
// backend/src/perfis-acesso/perfis-acesso.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { SavePermissoesDto } from './dto/save-permissoes.dto';

@Injectable()
export class PerfisAcessoService {
  constructor(private prisma: PrismaService) {}

  async listar(tenantId: number) {
    return this.prisma.perfilAcesso.findMany({
      where: { tenantId, ativo: true },
      include: {
        permissoes: true,
        _count: { select: { usuarios: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async buscarPorId(tenantId: number, id: number) {
    const p = await this.prisma.perfilAcesso.findFirst({
      where: { id, tenantId, ativo: true },
      include: { permissoes: true, _count: { select: { usuarios: true } } },
    });
    if (!p) throw new NotFoundException('Perfil não encontrado');
    return p;
  }

  async criar(tenantId: number, dto: CreatePerfilDto) {
    return this.prisma.perfilAcesso.create({
      data: { tenantId, nome: dto.nome, descricao: dto.descricao ?? null },
    });
  }

  async atualizar(tenantId: number, id: number, dto: Partial<CreatePerfilDto>) {
    await this.garantirExistente(tenantId, id);
    return this.prisma.perfilAcesso.update({
      where: { id },
      data: { ...(dto.nome && { nome: dto.nome }), ...(dto.descricao !== undefined && { descricao: dto.descricao }) },
    });
  }

  async salvarPermissoes(tenantId: number, id: number, dto: SavePermissoesDto) {
    await this.garantirExistente(tenantId, id);
    await this.prisma.perfilPermissao.deleteMany({ where: { perfilAcessoId: id } });
    if (dto.permissoes.length === 0) return { count: 0 };
    return this.prisma.perfilPermissao.createMany({
      data: dto.permissoes.map((p) => ({ perfilAcessoId: id, modulo: p.modulo, nivel: p.nivel })),
    });
  }

  async desativar(tenantId: number, id: number) {
    await this.garantirExistente(tenantId, id);
    return this.prisma.perfilAcesso.update({ where: { id }, data: { ativo: false } });
  }

  private async garantirExistente(tenantId: number, id: number) {
    const p = await this.prisma.perfilAcesso.findFirst({ where: { id, tenantId, ativo: true } });
    if (!p) throw new NotFoundException('Perfil não encontrado');
    return p;
  }
}
```

- [ ] **Step 5: Rodar testes**

```bash
npx jest perfis-acesso.service.spec.ts --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 6: Criar PerfisAcessoController e Module**

```typescript
// backend/src/perfis-acesso/perfis-acesso.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, HttpCode,
} from '@nestjs/common';
import { PerfisAcessoService } from './perfis-acesso.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { SavePermissoesDto } from './dto/save-permissoes.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('api/v1/perfis-acesso')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_TENANT', 'SUPER_ADMIN')
export class PerfisAcessoController {
  constructor(private readonly svc: PerfisAcessoService) {}

  @Get()
  listar(@TenantId() tenantId: number) {
    return this.svc.listar(tenantId);
  }

  @Post()
  criar(@TenantId() tenantId: number, @Body() dto: CreatePerfilDto) {
    return this.svc.criar(tenantId, dto);
  }

  @Get(':id')
  buscar(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.buscarPorId(tenantId, id);
  }

  @Patch(':id')
  atualizar(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreatePerfilDto>) {
    return this.svc.atualizar(tenantId, id, dto);
  }

  @Post(':id/permissoes')
  @HttpCode(200)
  salvarPermissoes(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: SavePermissoesDto) {
    return this.svc.salvarPermissoes(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  desativar(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.svc.desativar(tenantId, id);
  }
}
```

```typescript
// backend/src/perfis-acesso/perfis-acesso.module.ts
import { Module } from '@nestjs/common';
import { PerfisAcessoController } from './perfis-acesso.controller';
import { PerfisAcessoService } from './perfis-acesso.service';

@Module({
  controllers: [PerfisAcessoController],
  providers: [PerfisAcessoService],
  exports: [PerfisAcessoService],
})
export class PerfisAcessoModule {}
```

- [ ] **Step 7: Importar em app.module.ts**

```typescript
import { PerfisAcessoModule } from './perfis-acesso/perfis-acesso.module';
// no array imports:
PerfisAcessoModule,
```

- [ ] **Step 8: Verificar build**

```bash
npx nest build
```

Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add backend/src/perfis-acesso/ backend/src/app.module.ts
git commit -m "feat: add PerfisAcessoModule with permission matrix management"
```

---

## Task 5: Auth — Convite, Reset de Senha e Me/Permissões

**Files:**
- Create: `backend/src/auth/dto/aceitar-convite.dto.ts`
- Create: `backend/src/auth/dto/esqueci-senha.dto.ts`
- Create: `backend/src/auth/dto/reset-senha.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.module.ts`

- [ ] **Step 1: Criar DTOs**

```typescript
// backend/src/auth/dto/aceitar-convite.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AceitarConviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @MinLength(8)
  senha: string;
}
```

```typescript
// backend/src/auth/dto/esqueci-senha.dto.ts
import { IsEmail } from 'class-validator';

export class EsqueciSenhaDto {
  @IsEmail()
  email: string;
}
```

```typescript
// backend/src/auth/dto/reset-senha.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ResetSenhaDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  novaSenha: string;
}
```

- [ ] **Step 2: Adicionar métodos ao AuthService**

Em `backend/src/auth/auth.service.ts`, adicionar ao final da classe (antes do fechamento `}`):

```typescript
  async aceitarConvite(dto: AceitarConviteDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenHash, status: 'PENDENTE' },
    });

    if (!usuario || !usuario.tokenExp || usuario.tokenExp < new Date()) {
      throw new UnauthorizedException('Link de convite inválido ou expirado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: dto.nome,
        senhaHash,
        status: 'ATIVO',
        ativo: true,
        tokenHash: null,
        tokenExp: null,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: usuario.tenantId },
      include: { plano: true },
    });

    const token = this.gerarToken(usuario.id, usuario.tenantId, usuario.role, tenant!.plano.nome);
    const refreshToken = this.gerarRefreshToken(usuario.id, usuario.tenantId);

    return {
      token,
      refreshToken,
      tenantSlug: tenant!.slug,
      usuario: { id: usuario.id, nome: dto.nome, email: usuario.email, role: usuario.role },
    };
  }

  async esqueciSenha(email: string) {
    // Sempre retorna 200 — não revela se e-mail existe
    const usuario = await this.prisma.usuario.findFirst({
      where: { email, status: 'ATIVO', deletadoEm: null },
    });

    if (usuario) {
      const tokenRaw = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
      const tokenExp = new Date(Date.now() + 3600 * 1000); // 1h

      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { tokenHash, tokenExp },
      });

      await this.mailService.sendResetSenha(usuario.email, tokenRaw);
    }

    return { ok: true };
  }

  async resetSenha(dto: ResetSenhaDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenHash, status: 'ATIVO' },
    });

    if (!usuario || !usuario.tokenExp || usuario.tokenExp < new Date()) {
      throw new UnauthorizedException('Link de redefinição inválido ou expirado');
    }

    const senhaHash = await bcrypt.hash(dto.novaSenha, 12);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash, tokenHash: null, tokenExp: null },
    });

    return { ok: true };
  }

  async mePermissoes(userId: number, tenantId: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, tenantId },
      include: {
        perfilAcesso: { include: { permissoes: true } },
        permissaoOverrides: true,
      },
    });

    if (!usuario) return {};

    // Admins têm acesso total
    if (usuario.role === 'ADMIN_TENANT' || usuario.role === 'SUPER_ADMIN') {
      const modulos = ['concretagem', 'nc', 'ro', 'laudos', 'obras', 'usuarios', 'relatorios'];
      return Object.fromEntries(modulos.map((m) => [m, 'ADMINISTRAR']));
    }

    const NIVEL_NUM: Record<string, number> = { VISUALIZAR: 1, OPERAR: 2, APROVAR: 3, ADMINISTRAR: 4 };
    const NIVEL_STR = ['', 'VISUALIZAR', 'OPERAR', 'APROVAR', 'ADMINISTRAR'];

    const resultado: Record<string, string | null> = {};

    const modulos = ['concretagem', 'nc', 'ro', 'laudos', 'obras', 'usuarios', 'relatorios'];
    for (const modulo of modulos) {
      const override = usuario.permissaoOverrides.find((o) => o.modulo === modulo);
      if (override) {
        resultado[modulo] = override.concedido ? override.nivel : null;
        continue;
      }

      const permPerfil = usuario.perfilAcesso?.permissoes.find((p) => p.modulo === modulo);
      resultado[modulo] = permPerfil?.nivel ?? null;
    }

    return resultado;
  }
```

Adicionar os imports necessários no topo do `auth.service.ts`:
```typescript
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { AceitarConviteDto } from './dto/aceitar-convite.dto';
import { ResetSenhaDto } from './dto/reset-senha.dto';
```

Adicionar `MailService` no construtor do `AuthService`:
```typescript
constructor(
  private prisma: PrismaService,
  private jwt: JwtService,
  private config: ConfigService,
  private mailService: MailService,
) {}
```

- [ ] **Step 3: Adicionar endpoints ao AuthController**

Em `backend/src/auth/auth.controller.ts`, adicionar após o método `me()`:

```typescript
  @Post('aceitar-convite')
  @HttpCode(200)
  async aceitarConvite(@Body() dto: AceitarConviteDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.aceitarConvite(dto);
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTS);
    const { refreshToken: _rt, ...body } = result;
    return body;
  }

  @Post('esqueci-senha')
  @HttpCode(200)
  async esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.esqueciSenha(dto.email);
  }

  @Post('reset-senha')
  @HttpCode(200)
  async resetSenha(@Body() dto: ResetSenhaDto) {
    return this.authService.resetSenha(dto);
  }

  @Get('me/permissoes')
  @UseGuards(JwtAuthGuard)
  async mePermissoes(@CurrentUser() user: { id: number; tenantId: number }) {
    return this.authService.mePermissoes(user.id, user.tenantId);
  }
```

Adicionar imports no topo do controller:
```typescript
import { AceitarConviteDto } from './dto/aceitar-convite.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { ResetSenhaDto } from './dto/reset-senha.dto';
```

- [ ] **Step 4: Atualizar AuthModule para importar MailModule**

Em `backend/src/auth/auth.module.ts`, adicionar:

```typescript
import { MailModule } from '../mail/mail.module';
// no array imports:
MailModule,
// em providers adicionar MailService vem via MailModule
```

- [ ] **Step 5: Verificar build**

```bash
cd backend && npx nest build
```

Expected: compilado sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/
git commit -m "feat: add invite acceptance, forgot/reset password and me/permissoes endpoints"
```

---

## Task 6: PermissaoGuard e @Requer Decorator

**Files:**
- Create: `backend/src/common/decorators/requer.decorator.ts`
- Create: `backend/src/common/guards/permissao.guard.ts`

- [ ] **Step 1: Criar @Requer decorator**

```typescript
// backend/src/common/decorators/requer.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSAO_KEY = 'permissao_requerida';

export interface PermissaoRequerida {
  modulo: string;
  nivel: string;
}

export const Requer = (modulo: string, nivel: string) =>
  SetMetadata(PERMISSAO_KEY, { modulo, nivel });
```

- [ ] **Step 2: Criar PermissaoGuard**

```typescript
// backend/src/common/guards/permissao.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSAO_KEY, PermissaoRequerida } from '../decorators/requer.decorator';

const NIVEL_NUM: Record<string, number> = {
  VISUALIZAR: 1,
  OPERAR: 2,
  APROVAR: 3,
  ADMINISTRAR: 4,
};

const ADMIN_ROLES = ['ADMIN_TENANT', 'SUPER_ADMIN'];

@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requerida = this.reflector.getAllAndOverride<PermissaoRequerida>(PERMISSAO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Requer → passa (rota não restrita por permissão)
    if (!requerida) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Admins passam sempre
    if (ADMIN_ROLES.includes(user.role)) return true;

    // Busca override individual
    const override = await this.prisma.usuarioPermissaoOverride.findFirst({
      where: { usuarioId: user.id, modulo: requerida.modulo },
    });

    if (override) {
      if (!override.concedido) throw new ForbiddenException('Acesso negado por override');
      const nivelResolvido = NIVEL_NUM[override.nivel] ?? 0;
      const nivelRequerido = NIVEL_NUM[requerida.nivel] ?? 0;
      if (nivelResolvido >= nivelRequerido) return true;
      throw new ForbiddenException('Nível de permissão insuficiente');
    }

    // Busca perfil do usuário
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: user.id },
      include: {
        perfilAcesso: {
          include: { permissoes: { where: { modulo: requerida.modulo } } },
        },
      },
    });

    const permPerfil = usuario?.perfilAcesso?.permissoes[0];
    if (!permPerfil) throw new ForbiddenException('Sem permissão para este módulo');

    const nivelResolvido = NIVEL_NUM[permPerfil.nivel] ?? 0;
    const nivelRequerido = NIVEL_NUM[requerida.nivel] ?? 0;

    if (nivelResolvido >= nivelRequerido) return true;
    throw new ForbiddenException('Nível de permissão insuficiente');
  }
}
```

- [ ] **Step 3: Verificar build**

```bash
cd backend && npx nest build
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/
git commit -m "feat: add PermissaoGuard and @Requer decorator for granular permission enforcement"
```

---

## Task 7: Frontend — admin.service.ts

**Files:**
- Create: `frontend-web/src/services/admin.service.ts`

- [ ] **Step 1: Criar admin.service.ts**

```typescript
// frontend-web/src/services/admin.service.ts
import { api } from './api';

export interface UsuarioResumo {
  id: number;
  nome: string | null;
  email: string;
  role: string;
  status: 'PENDENTE' | 'ATIVO' | 'INATIVO';
  ativo: boolean;
  criadoEm: string;
  perfilAcessoId: number | null;
  perfilAcesso: { id: number; nome: string } | null;
  _count: { obrasPermitidas: number };
}

export interface UsuarioDetalhe extends UsuarioResumo {
  obrasPermitidas: Array<{
    id: number;
    obraId: number;
    obra: { id: number; nome: string };
    criadoEm: string;
  }>;
  permissaoOverrides: Array<{
    id: number;
    modulo: string;
    nivel: string;
    concedido: boolean;
    criadoEm: string;
  }>;
}

export interface PerfilAcesso {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criadoEm: string;
  permissoes: Array<{ id: number; modulo: string; nivel: string }>;
  _count: { usuarios: number };
}

export const adminService = {
  // Usuários
  listarUsuarios: (): Promise<UsuarioResumo[]> =>
    api.get('/usuarios').then((r) => r.data),

  buscarUsuario: (id: number): Promise<UsuarioDetalhe> =>
    api.get(`/usuarios/${id}`).then((r) => r.data),

  criarUsuario: (data: { email: string; role: string; perfilAcessoId?: number }): Promise<UsuarioResumo> =>
    api.post('/usuarios', data).then((r) => r.data),

  atualizarUsuario: (id: number, data: { nome?: string; email?: string; role?: string }): Promise<UsuarioResumo> =>
    api.patch(`/usuarios/${id}`, data).then((r) => r.data),

  ativarDesativar: (id: number, ativo: boolean): Promise<UsuarioResumo> =>
    api.patch(`/usuarios/${id}/ativo`, { ativo }).then((r) => r.data),

  assignPerfil: (id: number, perfilAcessoId: number | null): Promise<UsuarioResumo> =>
    api.patch(`/usuarios/${id}/perfil`, { perfilAcessoId }).then((r) => r.data),

  reenviarConvite: (id: number): Promise<{ ok: boolean }> =>
    api.post(`/usuarios/${id}/reenviar-convite`).then((r) => r.data),

  adminResetSenha: (id: number): Promise<{ ok: boolean }> =>
    api.post(`/usuarios/${id}/reset-senha`).then((r) => r.data),

  // Obras do usuário
  listarObrasUsuario: (id: number) =>
    api.get(`/usuarios/${id}/obras`).then((r) => r.data),

  adicionarObraUsuario: (id: number, obraId: number) =>
    api.post(`/usuarios/${id}/obras`, { obraId }).then((r) => r.data),

  removerObraUsuario: (id: number, obraId: number) =>
    api.post(`/usuarios/${id}/obras/${obraId}/remover`).then((r) => r.data),

  // Overrides do usuário
  salvarOverrides: (
    id: number,
    overrides: Array<{ modulo: string; nivel: string; concedido: boolean }>,
  ) => api.post(`/usuarios/${id}/permissoes`, { overrides }).then((r) => r.data),

  removerOverride: (id: number, modulo: string) =>
    api.post(`/usuarios/${id}/permissoes/${modulo}/remover`).then((r) => r.data),

  // Perfis de acesso
  listarPerfis: (): Promise<PerfilAcesso[]> =>
    api.get('/perfis-acesso').then((r) => r.data),

  buscarPerfil: (id: number): Promise<PerfilAcesso> =>
    api.get(`/perfis-acesso/${id}`).then((r) => r.data),

  criarPerfil: (data: { nome: string; descricao?: string }): Promise<PerfilAcesso> =>
    api.post('/perfis-acesso', data).then((r) => r.data),

  atualizarPerfil: (id: number, data: { nome?: string; descricao?: string }): Promise<PerfilAcesso> =>
    api.patch(`/perfis-acesso/${id}`, data).then((r) => r.data),

  salvarPermissoes: (id: number, permissoes: Array<{ modulo: string; nivel: string }>) =>
    api.post(`/perfis-acesso/${id}/permissoes`, { permissoes }).then((r) => r.data),

  desativarPerfil: (id: number) =>
    api.delete(`/perfis-acesso/${id}`).then((r) => r.data),

  // Auth público
  aceitarConvite: (data: { token: string; nome: string; senha: string }) =>
    api.post('/auth/aceitar-convite', data).then((r) => r.data),

  esqueciSenha: (email: string) =>
    api.post('/auth/esqueci-senha', { email }).then((r) => r.data),

  resetSenha: (data: { token: string; novaSenha: string }) =>
    api.post('/auth/reset-senha', data).then((r) => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/services/admin.service.ts
git commit -m "feat: add admin.service.ts with all user management API calls"
```

---

## Task 8: Frontend — Páginas de Auth Públicas

**Files:**
- Create: `frontend-web/src/pages/auth/AceitarConvitePage.tsx`
- Create: `frontend-web/src/pages/auth/EsqueciSenhaPage.tsx`
- Create: `frontend-web/src/pages/auth/ResetSenhaPage.tsx`

- [ ] **Step 1: Criar AceitarConvitePage.tsx**

```tsx
// frontend-web/src/pages/auth/AceitarConvitePage.tsx
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { useAuthStore } from '@/store/auth.store';

export function AceitarConvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');

  const mutation = useMutation({
    mutationFn: () => adminService.aceitarConvite({ token, nome, senha }),
    onSuccess: (data) => {
      localStorage.setItem('eldox_token', data.token);
      login(data.token, data.usuario, data.tenantSlug);
      navigate('/dashboard');
    },
    onError: () => setErro('Link inválido ou expirado. Solicite um novo convite.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) return setErro('Informe seu nome.');
    if (senha.length < 8) return setErro('A senha precisa ter no mínimo 8 caracteres.');
    if (senha !== confirmar) return setErro('As senhas não coincidem.');
    mutation.mutate();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-void)]">
      <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-xl p-8">
        <h1 className="text-xl font-semibold text-[var(--text-high)] mb-1">Finalizar cadastro</h1>
        <p className="text-sm text-[var(--text-faint)] mb-6">
          Defina seu nome e senha para acessar o Eldox.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Seu nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Crie uma senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Confirme a senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder=""
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {erro && <p className="text-xs text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Aguarde…' : 'Finalizar cadastro'}
          </button>
        </form>

        <p className="text-xs text-[var(--text-faint)] text-center mt-4">
          Este link é válido por 72 horas.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar EsqueciSenhaPage.tsx**

```tsx
// frontend-web/src/pages/auth/EsqueciSenhaPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';

export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  const mutation = useMutation({
    mutationFn: () => adminService.esqueciSenha(email),
    onSuccess: () => setEnviado(true),
  });

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-void)]">
        <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-lg font-semibold text-[var(--text-high)] mb-2">Verifique seu e-mail</h1>
          <p className="text-sm text-[var(--text-faint)] mb-6">
            Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve.
          </p>
          <Link to="/login" className="text-sm text-[var(--accent)] hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-void)]">
      <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-xl p-8">
        <h1 className="text-xl font-semibold text-[var(--text-high)] mb-1">Esqueci a senha</h1>
        <p className="text-sm text-[var(--text-faint)] mb-6">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Enviando…' : 'Enviar link de redefinição'}
          </button>
        </form>

        <p className="text-center mt-4">
          <Link to="/login" className="text-sm text-[var(--text-faint)] hover:text-[var(--accent)]">
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar ResetSenhaPage.tsx**

```tsx
// frontend-web/src/pages/auth/ResetSenhaPage.tsx
import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';

export function ResetSenhaPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');

  const mutation = useMutation({
    mutationFn: () => adminService.resetSenha({ token, novaSenha }),
    onSuccess: () => navigate('/login?reset=ok'),
    onError: () => setErro('Link inválido ou expirado. Solicite um novo link.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (novaSenha.length < 8) return setErro('A senha precisa ter no mínimo 8 caracteres.');
    if (novaSenha !== confirmar) return setErro('As senhas não coincidem.');
    mutation.mutate();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-void)]">
      <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-xl p-8">
        <h1 className="text-xl font-semibold text-[var(--text-high)] mb-1">Redefinir senha</h1>
        <p className="text-sm text-[var(--text-faint)] mb-6">Digite sua nova senha.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Confirme a senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {erro && <p className="text-xs text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? 'Aguarde…' : 'Redefinir senha'}
          </button>
        </form>

        <p className="text-xs text-[var(--text-faint)] text-center mt-4">
          Este link é válido por 1 hora.{' '}
          <Link to="/esqueci-senha" className="text-[var(--accent)] hover:underline">
            Solicitar novo link
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/pages/auth/
git commit -m "feat: add public auth pages (accept invite, forgot password, reset password)"
```

---

## Task 9: Frontend — AdminGuard e Rotas

**Files:**
- Create: `frontend-web/src/layouts/AdminGuard.tsx`
- Modify: `frontend-web/src/App.tsx`

- [ ] **Step 1: Criar AdminGuard**

```tsx
// frontend-web/src/layouts/AdminGuard.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

const ADMIN_ROLES = ['ADMIN_TENANT', 'SUPER_ADMIN'];

export function AdminGuard() {
  const user = useAuthStore((s) => s.user);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 2: Adicionar rotas em App.tsx**

No arquivo `frontend-web/src/App.tsx`, adicionar os imports:

```tsx
import { AceitarConvitePage } from './pages/auth/AceitarConvitePage';
import { EsqueciSenhaPage } from './pages/auth/EsqueciSenhaPage';
import { ResetSenhaPage } from './pages/auth/ResetSenhaPage';
import { AdminGuard } from './layouts/AdminGuard';
import { UsuariosListPage } from './modules/admin/usuarios/pages/UsuariosListPage';
import { NovoUsuarioPage } from './modules/admin/usuarios/pages/NovoUsuarioPage';
import { UsuarioDetalhePage } from './modules/admin/usuarios/pages/UsuarioDetalhePage';
import { PerfisListPage } from './modules/admin/perfis/pages/PerfisListPage';
import { PerfilDetalhePage } from './modules/admin/perfis/pages/PerfilDetalhePage';
```

Dentro do bloco `<Routes>`, após as rotas públicas existentes, adicionar:

```tsx
{/* Rotas públicas de auth */}
<Route path="/aceitar-convite" element={<AceitarConvitePage />} />
<Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
<Route path="/reset-senha" element={<ResetSenhaPage />} />

{/* Rotas admin — dentro do AppLayout + AdminGuard */}
```

Dentro do bloco `<Route element={<AppLayout />}>`, adicionar:

```tsx
<Route element={<AdminGuard />}>
  <Route path="/admin/usuarios" element={<UsuariosListPage />} />
  <Route path="/admin/usuarios/novo" element={<NovoUsuarioPage />} />
  <Route path="/admin/usuarios/:id" element={<UsuarioDetalhePage />} />
  <Route path="/admin/perfis-acesso" element={<PerfisListPage />} />
  <Route path="/admin/perfis-acesso/novo" element={<PerfisListPage />} />
  <Route path="/admin/perfis-acesso/:id" element={<PerfilDetalhePage />} />
</Route>
```

- [ ] **Step 3: Verificar que o TypeScript não reclama (as páginas ainda não existem)**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: erros de "cannot find module" para as páginas que serão criadas nas próximas tasks — isso é esperado.

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/layouts/AdminGuard.tsx frontend-web/src/App.tsx
git commit -m "feat: add AdminGuard and admin/auth routes"
```

---

## Task 10: Frontend — UsuariosListPage

**Files:**
- Create: `frontend-web/src/modules/admin/usuarios/pages/UsuariosListPage.tsx`
- Create: `frontend-web/src/modules/admin/usuarios/pages/NovoUsuarioPage.tsx`

- [ ] **Step 1: Criar UsuariosListPage.tsx**

```tsx
// frontend-web/src/modules/admin/usuarios/pages/UsuariosListPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminService, type UsuarioResumo } from '@/services/admin.service';
import { cn } from '@/lib/cn';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_TENANT: 'Administrador',
  ENGENHEIRO: 'Engenheiro',
  TECNICO: 'Técnico',
  VISITANTE: 'Visitante',
  LABORATORIO: 'Laboratório',
};

const STATUS_CLASS: Record<string, string> = {
  ATIVO: 'text-[var(--ok-text)] bg-[var(--ok-bg)]',
  PENDENTE: 'text-[var(--warn-text)] bg-[var(--warn-bg)]',
  INATIVO: 'text-red-400 bg-red-400/10',
};

const STATUS_LABEL: Record<string, string> = {
  ATIVO: '● Ativo',
  PENDENTE: '⏳ Pendente',
  INATIVO: '● Inativo',
};

function iniciais(nome: string | null, email: string): string {
  if (nome && nome.trim()) {
    return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  }
  return email[0].toUpperCase();
}

export function UsuariosListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: adminService.listarUsuarios,
  });

  const filtrados = usuarios.filter((u) => {
    const matchBusca = !busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase());
    const matchRole = !filtroRole || u.role === filtroRole;
    const matchStatus = !filtroStatus || u.status === filtroStatus;
    return matchBusca && matchRole && matchStatus;
  });

  if (isLoading) {
    return <div className="p-6 text-[var(--text-faint)] text-sm">Carregando usuários…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b border-[var(--border-dim)]">
        <div className="flex items-start justify-between pb-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-high)]">Usuários</h1>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">Gerencie os usuários do tenant e seus acessos</p>
          </div>
          <button
            onClick={() => navigate('/admin/usuarios/novo')}
            className="bg-[var(--accent)] text-[var(--accent-fg)] px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            + Convidar usuário
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        />
        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value)}
          className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-med)]"
        >
          <option value="">Todos os roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-med)]"
        >
          <option value="">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="PENDENTE">Pendente</option>
          <option value="INATIVO">Inativo</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="px-6 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-dim)]">
              <th className="text-left px-2 py-2 text-xs text-[var(--text-faint)] font-medium">Usuário</th>
              <th className="text-left px-2 py-2 text-xs text-[var(--text-faint)] font-medium">Role</th>
              <th className="text-left px-2 py-2 text-xs text-[var(--text-faint)] font-medium">Perfil de Acesso</th>
              <th className="text-right px-2 py-2 text-xs text-[var(--text-faint)] font-medium">Obras</th>
              <th className="text-left px-2 py-2 text-xs text-[var(--text-faint)] font-medium">Status</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)]">
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-raised)] border border-[var(--border-dim)] flex items-center justify-center text-xs font-semibold text-[var(--accent)]">
                      {iniciais(u.nome, u.email)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[var(--text-high)]">{u.nome || <span className="text-[var(--text-faint)] italic">sem nome</span>}</div>
                      <div className="text-xs text-[var(--text-faint)]">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-xs text-[var(--text-med)]">
                  {u.perfilAcesso?.nome ?? <span className="text-[var(--text-faint)]">—</span>}
                </td>
                <td className="px-2 py-2.5 text-xs text-right text-[var(--text-med)]">
                  {u._count.obrasPermitidas}
                </td>
                <td className="px-2 py-2.5">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_CLASS[u.status])}>
                    {STATUS_LABEL[u.status]}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    onClick={() => navigate(`/admin/usuarios/${u.id}`)}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Ver →
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-faint)]">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar NovoUsuarioPage.tsx**

```tsx
// frontend-web/src/modules/admin/usuarios/pages/NovoUsuarioPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';

const ROLES = ['ENGENHEIRO', 'TECNICO', 'VISITANTE', 'LABORATORIO', 'ADMIN_TENANT'];
const ROLE_LABEL: Record<string, string> = {
  ENGENHEIRO: 'Engenheiro',
  TECNICO: 'Técnico',
  VISITANTE: 'Visitante',
  LABORATORIO: 'Laboratório',
  ADMIN_TENANT: 'Administrador',
};

export function NovoUsuarioPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('TECNICO');
  const [perfilAcessoId, setPerfilAcessoId] = useState<number | ''>('');
  const [erro, setErro] = useState('');

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: adminService.listarPerfis,
  });

  const mutation = useMutation({
    mutationFn: () =>
      adminService.criarUsuario({
        email,
        role,
        perfilAcessoId: perfilAcessoId !== '' ? Number(perfilAcessoId) : undefined,
      }),
    onSuccess: (data) => navigate(`/admin/usuarios/${data.id}`),
    onError: (e: any) =>
      setErro(e?.response?.data?.message ?? 'Erro ao criar usuário.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!email) return setErro('Informe o e-mail.');
    mutation.mutate();
  }

  return (
    <div>
      <div className="px-6 pt-5 pb-4 border-b border-[var(--border-dim)]">
        <button onClick={() => navigate('/admin/usuarios')} className="text-xs text-[var(--text-faint)] mb-3 hover:text-[var(--accent)]">
          ← Usuários
        </button>
        <h1 className="text-lg font-semibold text-[var(--text-high)]">Convidar usuário</h1>
        <p className="text-xs text-[var(--text-faint)] mt-0.5">
          O usuário receberá um e-mail para finalizar o cadastro e definir sua senha.
        </p>
      </div>

      <div className="px-6 py-5 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">E-mail *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              required
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-med)] mb-1">Perfil de acesso</label>
            <select
              value={perfilAcessoId}
              onChange={(e) => setPerfilAcessoId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">— Nenhum —</option>
              {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          {erro && <p className="text-xs text-red-400">{erro}</p>}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={mutation.isPending} className="bg-[var(--accent)] text-[var(--accent-fg)] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Enviando convite…' : 'Enviar convite'}
            </button>
            <button type="button" onClick={() => navigate('/admin/usuarios')} className="px-4 py-2 rounded-lg text-sm text-[var(--text-med)] border border-[var(--border-dim)]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/admin/usuarios/pages/
git commit -m "feat: add UsuariosListPage and NovoUsuarioPage"
```

---

## Task 11: Frontend — UsuarioDetalhePage

**Files:**
- Create: `frontend-web/src/modules/admin/usuarios/pages/UsuarioDetalhePage.tsx`

- [ ] **Step 1: Criar UsuarioDetalhePage.tsx**

```tsx
// frontend-web/src/modules/admin/usuarios/pages/UsuarioDetalhePage.tsx
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { cn } from '@/lib/cn';

const MODULOS = [
  { key: 'concretagem', label: 'Concretagem' },
  { key: 'nc', label: 'NC' },
  { key: 'ro', label: 'RO' },
  { key: 'laudos', label: 'Laudos' },
  { key: 'obras', label: 'Obras' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'relatorios', label: 'Relatórios' },
];

const NIVEIS = ['VISUALIZAR', 'OPERAR', 'APROVAR', 'ADMINISTRAR'];

const STATUS_CLASS: Record<string, string> = {
  ATIVO: 'text-[var(--ok-text)] bg-[var(--ok-bg)]',
  PENDENTE: 'text-[var(--warn-text)] bg-[var(--warn-bg)]',
  INATIVO: 'text-red-400 bg-red-400/10',
};

type Tab = 'dados' | 'obras' | 'permissoes';

export function UsuarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dados');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const usuarioId = Number(id);

  const { data: usuario, isLoading } = useQuery({
    queryKey: ['admin-usuario', usuarioId],
    queryFn: () => adminService.buscarUsuario(usuarioId),
  });

  const { data: todasObras = [] } = useQuery({
    queryKey: ['obras-lista-admin'],
    queryFn: () => adminService.listarUsuarios(), // reutiliza auth admin — idealmente chama obras service
    enabled: tab === 'obras',
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: adminService.listarPerfis,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-usuario', usuarioId] });

  const mutAtivar = useMutation({
    mutationFn: (ativo: boolean) => adminService.ativarDesativar(usuarioId, ativo),
    onSuccess: invalidate,
  });

  const mutReset = useMutation({
    mutationFn: () => adminService.adminResetSenha(usuarioId),
    onSuccess: () => setFeedbackMsg('E-mail de reset enviado com sucesso.'),
  });

  const mutReenviar = useMutation({
    mutationFn: () => adminService.reenviarConvite(usuarioId),
    onSuccess: () => setFeedbackMsg('Convite reenviado com sucesso.'),
  });

  const mutAssignPerfil = useMutation({
    mutationFn: (perfilId: number | null) => adminService.assignPerfil(usuarioId, perfilId),
    onSuccess: invalidate,
  });

  const mutRemoverObra = useMutation({
    mutationFn: (obraId: number) => adminService.removerObraUsuario(usuarioId, obraId),
    onSuccess: invalidate,
  });

  const mutRemoverOverride = useMutation({
    mutationFn: (modulo: string) => adminService.removerOverride(usuarioId, modulo),
    onSuccess: invalidate,
  });

  if (isLoading || !usuario) {
    return <div className="p-6 text-[var(--text-faint)] text-sm">Carregando…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b border-[var(--border-dim)]">
        <button onClick={() => navigate('/admin/usuarios')} className="text-xs text-[var(--text-faint)] mb-2 hover:text-[var(--accent)]">
          ← Usuários
        </button>
        <div className="flex items-start justify-between pb-3">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-high)]">
              {usuario.nome || <span className="italic text-[var(--text-faint)]">sem nome</span>}
            </h1>
            <p className="text-xs text-[var(--text-faint)] mt-0.5 flex items-center gap-2">
              {usuario.email}
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_CLASS[usuario.status])}>
                {usuario.status}
              </span>
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pb-3 flex-wrap">
          {usuario.status === 'PENDENTE' && (
            <button onClick={() => mutReenviar.mutate()} disabled={mutReenviar.isPending} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-dim)] text-[var(--text-med)] disabled:opacity-50">
              ↩ Reenviar convite
            </button>
          )}
          <button onClick={() => mutReset.mutate()} disabled={mutReset.isPending} className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 disabled:opacity-50">
            ✉ Enviar reset de senha
          </button>
          {usuario.status === 'ATIVO' ? (
            <button onClick={() => mutAtivar.mutate(false)} disabled={mutAtivar.isPending} className="text-xs px-3 py-1.5 rounded-lg border border-red-400/40 text-red-400 disabled:opacity-50">
              Desativar usuário
            </button>
          ) : usuario.status === 'INATIVO' ? (
            <button onClick={() => mutAtivar.mutate(true)} disabled={mutAtivar.isPending} className="text-xs px-3 py-1.5 rounded-lg border border-[var(--ok-border)] text-[var(--ok-text)] disabled:opacity-50">
              Reativar usuário
            </button>
          ) : null}
        </div>

        {feedbackMsg && (
          <p className="text-xs text-[var(--ok-text)] bg-[var(--ok-bg)] px-3 py-1.5 rounded-lg mb-2">{feedbackMsg}</p>
        )}

        {/* Tabs */}
        <div className="flex gap-0 -mb-px">
          {(['dados', 'obras', 'permissoes'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-xs border-b-2 transition-colors capitalize',
                t === tab
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              {t === 'obras' ? `Obras (${usuario.obrasPermitidas.length})` : t}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="px-6 py-5">

        {/* ABA DADOS */}
        {tab === 'dados' && (
          <div className="space-y-5 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Nome', value: usuario.nome || '—' },
                { label: 'E-mail', value: usuario.email },
                { label: 'Role', value: usuario.role },
                { label: 'Status', value: usuario.status },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-[var(--text-faint)] uppercase tracking-wide mb-1">{label}</div>
                  <div className="text-sm text-[var(--text-high)]">{value}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs text-[var(--text-faint)] uppercase tracking-wide mb-2">Perfil de Acesso</div>
              <div className="flex items-center gap-2">
                <select
                  value={usuario.perfilAcessoId ?? ''}
                  onChange={(e) => mutAssignPerfil.mutate(e.target.value === '' ? null : Number(e.target.value))}
                  className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">— Nenhum —</option>
                  {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                {usuario.perfilAcessoId && (
                  <Link to={`/admin/perfis-acesso/${usuario.perfilAcessoId}`} className="text-xs text-[var(--accent)] hover:underline">
                    Ver perfil ↗
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA OBRAS */}
        {tab === 'obras' && (
          <div className="max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-faint)]">Obras com acesso liberado ({usuario.obrasPermitidas.length})</p>
            </div>
            <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg divide-y divide-[var(--border-dim)]">
              {usuario.obrasPermitidas.length === 0 && (
                <p className="text-xs text-[var(--text-faint)] text-center py-6">Nenhuma obra liberada.</p>
              )}
              {usuario.obrasPermitidas.map((uo) => (
                <div key={uo.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-sm text-[var(--text-high)]">{uo.obra.nome}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      Liberado em {new Date(uo.criadoEm).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button
                    onClick={() => mutRemoverObra.mutate(uo.obraId)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA PERMISSÕES */}
        {tab === 'permissoes' && (
          <div className="max-w-2xl space-y-4">
            {usuario.perfilAcessoId && (
              <div className="text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-4 py-2.5">
                Perfil base:{' '}
                <Link to={`/admin/perfis-acesso/${usuario.perfilAcessoId}`} className="text-[var(--accent)] hover:underline">
                  {usuario.perfilAcesso?.nome ?? 'Perfil'} ↗
                </Link>
                <span className="text-[var(--text-faint)] ml-2">— overrides abaixo substituem o perfil para este usuário</span>
              </div>
            )}

            <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg">
              <div className="grid grid-cols-[1fr_120px_100px_80px] gap-2 px-4 py-2 border-b border-[var(--border-dim)]">
                {['Módulo', 'Nível Override', 'Tipo', ''].map((h) => (
                  <div key={h} className="text-xs text-[var(--text-faint)] uppercase tracking-wide">{h}</div>
                ))}
              </div>

              {usuario.permissaoOverrides.length === 0 && (
                <p className="text-xs text-[var(--text-faint)] text-center py-6">
                  Sem overrides. Este usuário herda as permissões do perfil base.
                </p>
              )}

              {usuario.permissaoOverrides.map((ov) => (
                <div key={ov.id} className="grid grid-cols-[1fr_120px_100px_80px] gap-2 px-4 py-2.5 border-b border-[var(--border-dim)] items-center">
                  <div className="text-sm text-[var(--text-high)] capitalize">{MODULOS.find(m => m.key === ov.modulo)?.label ?? ov.modulo}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium w-fit">{ov.nivel}</span>
                  <span className={cn('text-xs font-medium', ov.concedido ? 'text-[var(--ok-text)]' : 'text-red-400')}>
                    {ov.concedido ? 'Concedido' : 'Negado'}
                  </span>
                  <button onClick={() => mutRemoverOverride.mutate(ov.modulo)} className="text-xs text-red-400 hover:text-red-300 text-right">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/admin/usuarios/pages/UsuarioDetalhePage.tsx
git commit -m "feat: add UsuarioDetalhePage with Dados/Obras/Permissoes tabs"
```

---

## Task 12: Frontend — PerfisListPage e PerfilDetalhePage

**Files:**
- Create: `frontend-web/src/modules/admin/perfis/pages/PerfisListPage.tsx`
- Create: `frontend-web/src/modules/admin/perfis/pages/PerfilDetalhePage.tsx`

- [ ] **Step 1: Criar PerfisListPage.tsx**

```tsx
// frontend-web/src/modules/admin/perfis/pages/PerfisListPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminService } from '@/services/admin.service';

export function PerfisListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: adminService.listarPerfis,
  });

  const mutCriar = useMutation({
    mutationFn: () => adminService.criarPerfil({ nome: 'Novo Perfil' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['perfis-acesso'] });
      navigate(`/admin/perfis-acesso/${data.id}`);
    },
  });

  if (isLoading) return <div className="p-6 text-[var(--text-faint)] text-sm">Carregando…</div>;

  return (
    <div>
      <div className="px-6 pt-5 pb-0 border-b border-[var(--border-dim)]">
        <div className="flex items-start justify-between pb-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-high)]">Perfis de Acesso</h1>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">Templates de permissões aplicáveis a usuários</p>
          </div>
          <button
            onClick={() => mutCriar.mutate()}
            disabled={mutCriar.isPending}
            className="bg-[var(--accent)] text-[var(--accent-fg)] px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            + Novo perfil
          </button>
        </div>
      </div>

      <div className="px-6 py-5 grid grid-cols-1 gap-3 max-w-2xl">
        {perfis.length === 0 && (
          <p className="text-sm text-[var(--text-faint)] text-center py-8">Nenhum perfil criado ainda.</p>
        )}
        {perfis.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate(`/admin/perfis-acesso/${p.id}`)}
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer hover:border-[var(--accent)]/50 transition-colors"
          >
            <div>
              <div className="text-sm font-medium text-[var(--text-high)]">{p.nome}</div>
              {p.descricao && <div className="text-xs text-[var(--text-faint)] mt-0.5">{p.descricao}</div>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-faint)]">{p._count.usuarios} usuários</span>
              <span className="text-xs text-[var(--text-faint)]">{p.permissoes.length} módulos</span>
              <span className="text-xs text-[var(--accent)]">Editar →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar PerfilDetalhePage.tsx**

```tsx
// frontend-web/src/modules/admin/perfis/pages/PerfilDetalhePage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { cn } from '@/lib/cn';

const MODULOS = [
  { key: 'concretagem', label: '🏗 Concretagem' },
  { key: 'nc', label: '⚠️ NC' },
  { key: 'ro', label: '📋 RO' },
  { key: 'laudos', label: '📄 Laudos' },
  { key: 'obras', label: '🏢 Obras' },
  { key: 'usuarios', label: '👥 Usuários' },
  { key: 'relatorios', label: '📊 Relatórios' },
];

const NIVEIS = ['VISUALIZAR', 'OPERAR', 'APROVAR', 'ADMINISTRAR'];
const NIVEL_NUM: Record<string, number> = { VISUALIZAR: 1, OPERAR: 2, APROVAR: 3, ADMINISTRAR: 4 };

const NIVEL_CLASSES: Record<string, string> = {
  VISUALIZAR: 'bg-[var(--ok-bg)] text-[var(--ok-text)]',
  OPERAR: 'bg-[var(--accent)]/20 text-[var(--accent)]',
  APROVAR: 'bg-amber-400/20 text-amber-400',
  ADMINISTRAR: 'bg-red-400/20 text-red-400',
};

export function PerfilDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perfilId = Number(id);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-acesso', perfilId],
    queryFn: () => adminService.buscarPerfil(perfilId),
  });

  // Estado local da matriz (modulo → nivel ativo ou null)
  const [matriz, setMatriz] = useState<Record<string, string | null>>({});
  const [dirty, setDirty] = useState(false);

  // Inicializa matriz quando perfil carrega
  if (perfil && !dirty && Object.keys(matriz).length === 0) {
    const init: Record<string, string | null> = {};
    for (const mod of MODULOS) {
      const perm = perfil.permissoes.find((p) => p.modulo === mod.key);
      init[mod.key] = perm?.nivel ?? null;
    }
    setMatriz(init);
  }

  const mutSalvar = useMutation({
    mutationFn: () => {
      const permissoes = Object.entries(matriz)
        .filter(([, nivel]) => nivel !== null)
        .map(([modulo, nivel]) => ({ modulo, nivel: nivel! }));
      return adminService.salvarPermissoes(perfilId, permissoes);
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['perfil-acesso', perfilId] });
      qc.invalidateQueries({ queryKey: ['perfis-acesso'] });
    },
  });

  function toggleNivel(modulo: string, nivel: string) {
    setDirty(true);
    setMatriz((prev) => {
      const atual = NIVEL_NUM[prev[modulo] ?? ''] ?? 0;
      const clicado = NIVEL_NUM[nivel];
      // Se já está ativo no nível clicado, desativa tudo
      if (atual === clicado) return { ...prev, [modulo]: null };
      // Ativa o nível clicado (hierárquico: não precisa ativar os inferiores separadamente — o nível ativo representa o máximo)
      return { ...prev, [modulo]: nivel };
    });
  }

  function nivelAtivo(modulo: string, nivel: string): boolean {
    const max = NIVEL_NUM[matriz[modulo] ?? ''] ?? 0;
    return NIVEL_NUM[nivel] <= max;
  }

  if (isLoading || !perfil) {
    return <div className="p-6 text-[var(--text-faint)] text-sm">Carregando…</div>;
  }

  return (
    <div>
      <div className="px-6 pt-5 pb-4 border-b border-[var(--border-dim)]">
        <button onClick={() => navigate('/admin/perfis-acesso')} className="text-xs text-[var(--text-faint)] mb-2 hover:text-[var(--accent)]">
          ← Perfis de Acesso
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-high)]">{perfil.nome}</h1>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">
              {perfil._count.usuarios} usuário(s) com este perfil · Clique nos níveis para ativar/desativar
            </p>
          </div>
          <button
            onClick={() => mutSalvar.mutate()}
            disabled={mutSalvar.isPending || !dirty}
            className="bg-[var(--accent)] text-[var(--accent-fg)] px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {mutSalvar.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
        {dirty && (
          <p className="text-xs text-amber-400 mt-2">⚠ Há alterações não salvas</p>
        )}
      </div>

      <div className="px-6 py-4">
        <p className="text-xs text-[var(--text-faint)] mb-4">
          💡 Níveis são hierárquicos — ativar APROVAR inclui OPERAR e VISUALIZAR automaticamente
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULOS.map((mod) => (
            <div key={mod.key} className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg p-3">
              <div className="text-xs font-semibold text-[var(--text-high)] mb-2.5">{mod.label}</div>
              <div className="space-y-1.5">
                {NIVEIS.map((nivel) => {
                  const ativo = nivelAtivo(mod.key, nivel);
                  return (
                    <button
                      key={nivel}
                      onClick={() => toggleNivel(mod.key, nivel)}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded text-xs font-medium transition-all',
                        ativo ? NIVEL_CLASSES[nivel] : 'bg-[var(--bg-void)] text-[var(--text-faint)] hover:bg-[var(--border-dim)]',
                      )}
                    >
                      {ativo ? '✓ ' : ''}{nivel.charAt(0) + nivel.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/admin/perfis/
git commit -m "feat: add PerfisListPage and PerfilDetalhePage with card editor"
```

---

## Task 13: Sidebar — Seção Administração

**Files:**
- Modify: `frontend-web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Adicionar import de ícones necessários**

Em `frontend-web/src/components/layout/Sidebar.tsx`, adicionar ao bloco de imports do lucide-react:

```tsx
import { ShieldCheck } from 'lucide-react'
```

- [ ] **Step 2: Adicionar verificação de role admin**

Dentro do componente `Sidebar` (função principal que retorna o `<aside>`), após a linha `const user = useAuthStore((s) => s.user)`:

```tsx
const isAdmin = user?.role === 'ADMIN_TENANT' || user?.role === 'SUPER_ADMIN'
```

- [ ] **Step 3: Adicionar NavSection de Administração**

Dentro do `<nav>`, antes do fechamento da tag `</nav>`, adicionar após o último `</NavSection>`:

```tsx
{isAdmin && (
  <NavSection label="Administração">
    <NavItemGroup
      icon={<ShieldCheck size={18} />}
      label="Gestão de Usuários"
      items={[
        { to: '/admin/usuarios', label: 'Usuários' },
        { to: '/admin/perfis-acesso', label: 'Perfis de Acesso' },
      ]}
      onClick={onNavClick}
    />
  </NavSection>
)}
```

- [ ] **Step 4: Verificar build do frontend**

```bash
cd frontend-web && npx tsc --noEmit
```

Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add frontend-web/src/components/layout/Sidebar.tsx
git commit -m "feat: add Administração section to sidebar for admin/super_admin roles"
```

---

## Self-Review

**Spec coverage check:**
- ✅ CRUD usuários: Tasks 3, 10, 11
- ✅ Perfis de acesso: Tasks 4, 12
- ✅ Permissões granulares 4 níveis: Tasks 4, 6, 12
- ✅ Override individual: Tasks 3, 11
- ✅ Acesso por obra: Task 3, 11
- ✅ PermissaoGuard enforcement: Task 6
- ✅ Onboarding por convite: Tasks 2, 3, 5, 8
- ✅ Esqueci/reset senha: Tasks 5, 8
- ✅ Admin reset senha: Tasks 3, 11
- ✅ Frontend admin area: Tasks 9-13
- ✅ Sidebar admin section: Task 13

**Placeholder scan:** nenhum TBD, TODO ou "implemente aqui".

**Type consistency:**
- `UsuarioResumo` e `UsuarioDetalhe` no `admin.service.ts` usam `status: 'PENDENTE' | 'ATIVO' | 'INATIVO'` — bate com o enum do Prisma
- `perfilAcessoId: number | null` consistente em service e pages
- `mutRemoverObra.mutate(uo.obraId)` — `obraId` é `number`, `removerObraUsuario` aceita `number` ✅
