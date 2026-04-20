import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PermissoesResolverService } from '../common/services/permissoes-resolver.service';
import type { JwtModuleOptions } from '@nestjs/jwt';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET')!,
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '8h') as any,
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    ConfigService,
    PermissoesResolverService,
  ],
  controllers: [AuthController],
  exports: [PermissoesResolverService],
})
export class AuthModule {}
