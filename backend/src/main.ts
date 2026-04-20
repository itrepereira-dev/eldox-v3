import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

const isProduction = process.env.NODE_ENV === 'production';

const winstonTransports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
];

if (isProduction) {
  winstonTransports.push(
    new winston.transports.File({
      filename: 'logs/app.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: WinstonModule.createLogger({
      transports: winstonTransports,
    }),
  });

  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS: lista explícita via FRONTEND_URL (separada por vírgula) + wildcard *.eldox.com.br
  // Fallback para portas locais de dev quando FRONTEND_URL não está setado.
  const corsOrigins = (
    process.env.FRONTEND_URL ??
    'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:3001'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const eldoxDomainRe = /^https?:\/\/([a-z0-9-]+\.)?eldox\.com\.br$/i;

  app.enableCors({
    origin: (origin, callback) => {
      // Requisições same-origin, apps mobile ou curl não enviam Origin header
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      if (eldoxDomainRe.test(origin)) return callback(null, true);
      return callback(new Error(`CORS bloqueado: origem "${origin}" não permitida`));
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API rodando em http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
