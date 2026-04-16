import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
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

    // Configuração global do Bull (Redis) — usada por todos os módulos com BullModule.registerQueue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD ?? undefined,
      },
    }),

    PrismaModule,
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
})
export class AppModule {}
