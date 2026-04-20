import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterTenantDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AceitarConviteDto } from './dto/aceitar-convite.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { ResetSenhaDto } from './dto/reset-senha.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/tenant.decorator';
import { PermissoesResolverService } from '../common/services/permissoes-resolver.service';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7d em ms
  path: '/',
};

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissoes: PermissoesResolverService,
  ) {}

  @Post('register')
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  async register(
    @Body() dto: RegisterTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTS);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _rt, ...body } = result;
    return body;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 900_000 },
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTS);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _rt, ...body } = result;
    return body;
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 60, ttl: 900_000 },
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token;
    if (!token) throw new UnauthorizedException('Refresh token ausente');
    const result = await this.authService.refresh(token);
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTS);
    return { token: result.token };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user;
  }

  @Get('me/permissoes')
  @UseGuards(JwtAuthGuard)
  async mePermissoes(@CurrentUser() user: any) {
    return this.permissoes.mapaPermissoes(user.id, user.role);
  }

  @Post('aceitar-convite')
  @HttpCode(200)
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 50, ttl: 900_000 },
  })
  async aceitarConvite(@Body() dto: AceitarConviteDto) {
    return this.authService.aceitarConvite(dto);
  }

  @Post('esqueci-senha')
  @HttpCode(200)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  async esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.esqueciSenha(dto);
  }

  @Post('reset-senha')
  @HttpCode(200)
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 50, ttl: 900_000 },
  })
  async resetSenha(@Body() dto: ResetSenhaDto) {
    return this.authService.resetSenha(dto);
  }
}
