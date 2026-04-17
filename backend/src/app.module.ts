import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ObrasModule } from './obras/obras.module';
import { GedModule } from './ged/ged.module';
import { FvsModule } from './fvs/fvs.module';
import { IaModule } from './ia/ia.module';
import { FvmModule } from './fvm/fvm.module';
import { DiarioModule } from './diario/diario.module';
import { EnsaiosModule } from './ensaios/ensaios.module';
import { ConcretagemModule } from './concretagem/concretagem.module';
import { AlmoxarifadoModule } from './almoxarifado/almoxarifado.module';
import { NcsModule } from './ncs/ncs.module';
import { SemaforoModule } from './semaforo/semaforo.module';
import { AprovacoesModule } from './aprovacoes/aprovacoes.module';
import { EfetivoModule } from './efetivo/efetivo.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlanosAcaoModule } from './planos-acao/planos-acao.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting — default global (60 req/min por IP) + buckets nomeados
    // sobrescrevíveis via @Throttle() em controllers específicos (ex.: auth).
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 }, // 10 req/s por IP
      { name: 'medium', ttl: 10_000, limit: 60 }, // 60 req/10s por IP
      { name: 'long', ttl: 60_000, limit: 300 }, // 300 req/min por IP
    ]),

    // Configuração global do Bull (Redis) — usada por todos os módulos com BullModule.registerQueue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD ?? undefined,
      },
    }),

    PrismaModule,
    HealthModule,
    AuthModule,
    ObrasModule,
    GedModule,
    FvsModule,
    FvmModule,
    IaModule,
    DiarioModule,
    EnsaiosModule,
    ConcretagemModule,
    AlmoxarifadoModule,
    NcsModule,
    SemaforoModule,
    AprovacoesModule,
    EfetivoModule,
    DashboardModule,
    PlanosAcaoModule,
  ],
  providers: [
    // Aplica ThrottlerGuard globalmente — todo endpoint passa a ter rate-limit
    // default. Endpoints específicos podem sobrescrever com @Throttle(...) ou
    // desativar com @SkipThrottle() (ex.: webhooks públicos).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
