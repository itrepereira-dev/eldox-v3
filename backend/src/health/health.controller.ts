import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';
import * as Minio from 'minio';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health & Readiness probes.
 *
 *  - `GET /api/v1/health`   — liveness (só responde 200 se o processo está de pé)
 *  - `GET /api/v1/ready`    — readiness (checa DB + Redis + MinIO)
 *
 * Sem auth (Coolify, Traefik e Uptime-Kuma consomem).
 */
@Controller('api/v1')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  @HealthCheck()
  liveness() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => ({
        process: { status: 'up' },
      }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      // PostgreSQL
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (err) {
          this.logger.error({ msg: 'ready.database.fail', err });
          throw new HealthCheckError('Database unreachable', {
            database: { status: 'down' },
          });
        }
      },
      // Redis
      async (): Promise<HealthIndicatorResult> => {
        const redis = new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
        });
        try {
          await redis.connect();
          const pong = await redis.ping();
          return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
        } catch (err) {
          this.logger.error({ msg: 'ready.redis.fail', err });
          throw new HealthCheckError('Redis unreachable', {
            redis: { status: 'down' },
          });
        } finally {
          await redis.quit().catch(() => {
            /* noop */
          });
        }
      },
      // MinIO
      async (): Promise<HealthIndicatorResult> => {
        try {
          const client = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
            port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
            useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY ?? '',
            secretKey: process.env.MINIO_SECRET_KEY ?? '',
          });
          const bucket = process.env.MINIO_BUCKET ?? 'eldox-ged';
          const exists = await client.bucketExists(bucket);
          return { minio: { status: exists ? 'up' : 'down', bucket } };
        } catch (err) {
          this.logger.error({ msg: 'ready.minio.fail', err });
          throw new HealthCheckError('MinIO unreachable', {
            minio: { status: 'down' },
          });
        }
      },
    ]);
  }
}
