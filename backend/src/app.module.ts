import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ObrasModule } from './obras/obras.module';
import { GedModule } from './ged/ged.module';
import { FvsModule } from './fvs/fvs.module';

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
  ],
})
export class AppModule {}
