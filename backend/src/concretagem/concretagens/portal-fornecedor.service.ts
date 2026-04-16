// backend/src/concretagem/concretagens/portal-fornecedor.service.ts
import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ConcrtagemPortalView {
  numero: string;
  obra_nome: string;
  elemento_estrutural: string;
  data_programada: string;
  hora_programada: string | null;
  volume_previsto: number;
  fck_especificado: number;
  traco_especificado: string | null;
  bombeado: boolean;
  intervalo_min_caminhoes: number | null;
  status: string;
  fornecedor_nome: string | null;
  caminhoes: CaminhaoPortalView[];
}

export interface CaminhaoPortalView {
  sequencia: number;
  numero_nf: string;
  volume: number;
  status: string;
  hora_chegada: string | null;
  hora_inicio_lancamento: string | null;
  hora_fim_lancamento: string | null;
  elemento_lancado: string | null;
}

@Injectable()
export class PortalFornecedorService {
  private readonly logger = new Logger(PortalFornecedorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buscarPorToken(token: string): Promise<ConcrtagemPortalView> {
    // Validate token
    const tokenRows = await this.prisma.$queryRawUnsafe<{
      tenant_id: number;
      concretagem_id: number;
      expires_at: Date;
    }[]>(
      `SELECT tenant_id, concretagem_id, expires_at
       FROM fornecedor_portal_tokens
       WHERE token = $1 LIMIT 1`,
      token,
    );

    if (!tokenRows[0]) throw new NotFoundException('Link inválido ou expirado');

    const { tenant_id, concretagem_id, expires_at } = tokenRows[0];

    if (new Date() > new Date(expires_at)) {
      throw new UnauthorizedException('Link expirado. Solicite um novo envio pelo sistema.');
    }

    // Fetch concretagem
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         b.numero, b.elemento_estrutural, b.data_programada::text, b.hora_programada,
         b.volume_previsto, b.fck_especificado, b.traco_especificado,
         b.bombeado, b.intervalo_min_caminhoes, b.status::text,
         o.nome AS obra_nome,
         f.razao_social AS fornecedor_nome
       FROM concretagens b
       JOIN "Obra" o ON o.id = b.obra_id
       LEFT JOIN fornecedores f ON f.id = b.fornecedor_id AND f.tenant_id = $1
       WHERE b.tenant_id = $1 AND b.id = $2 AND b.deleted_at IS NULL`,
      tenant_id, concretagem_id,
    );

    if (!rows[0]) throw new NotFoundException('Programação não encontrada');

    const concretagem = rows[0];

    // Fetch caminhões
    const caminhoes = await this.prisma.$queryRawUnsafe<CaminhaoPortalView[]>(
      `SELECT
         sequencia, numero_nf, CAST(volume AS FLOAT) AS volume,
         status::text, hora_chegada::text, hora_inicio_lancamento::text,
         hora_fim_lancamento::text, elemento_lancado
       FROM caminhoes_concreto
       WHERE tenant_id = $1 AND concretagem_id = $2
       ORDER BY sequencia ASC`,
      tenant_id, concretagem_id,
    );

    return {
      numero:                  concretagem.numero,
      obra_nome:               concretagem.obra_nome,
      elemento_estrutural:     concretagem.elemento_estrutural,
      data_programada:         concretagem.data_programada,
      hora_programada:         concretagem.hora_programada ?? null,
      volume_previsto:         Number(concretagem.volume_previsto),
      fck_especificado:        Number(concretagem.fck_especificado),
      traco_especificado:      concretagem.traco_especificado ?? null,
      bombeado:                concretagem.bombeado,
      intervalo_min_caminhoes: concretagem.intervalo_min_caminhoes ? Number(concretagem.intervalo_min_caminhoes) : null,
      status:                  concretagem.status,
      fornecedor_nome:         concretagem.fornecedor_nome ?? null,
      caminhoes,
    };
  }
}
