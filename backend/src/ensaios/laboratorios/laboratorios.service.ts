// backend/src/ensaios/laboratorios/laboratorios.service.ts
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLaboratorioDto } from './dto/create-laboratorio.dto';

export interface Laboratorio {
  id: number;
  tenant_id: number;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  ativo: boolean;
  created_at: Date;
}

@Injectable()
export class LaboratoriosService {
  private readonly logger = new Logger(LaboratoriosService.name);

  constructor(private readonly prisma: PrismaService) {}

  private auditLog(tenantId: number, userId: number, acao: string, entidadeId: number, detalhes: object): void {
    this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, detalhes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      tenantId, userId, acao, 'laboratorios', entidadeId, JSON.stringify(detalhes),
    ).catch(() => {
      this.logger.error(JSON.stringify({
        audit: true, tenant_id: tenantId, usuario_id: userId,
        acao, entidade: 'laboratorios', entidade_id: entidadeId, detalhes,
      }));
    });
  }

  async listar(tenantId: number): Promise<Laboratorio[]> {
    return this.prisma.$queryRawUnsafe<Laboratorio[]>(
      `SELECT * FROM laboratorios WHERE tenant_id = $1 AND ativo = TRUE ORDER BY nome`,
      tenantId,
    );
  }

  async criar(tenantId: number, userId: number, dto: CreateLaboratorioDto): Promise<Laboratorio> {
    // Verificar duplicidade de nome ativo no tenant
    const existe = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM laboratorios WHERE tenant_id = $1 AND nome = $2 AND ativo = TRUE`,
      tenantId, dto.nome,
    );
    if (existe.length) {
      throw new ConflictException(`Já existe um laboratório ativo com o nome "${dto.nome}" neste tenant`);
    }

    const rows = await this.prisma.$queryRawUnsafe<Laboratorio[]>(
      `INSERT INTO laboratorios (tenant_id, nome, cnpj, contato)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      tenantId, dto.nome, dto.cnpj ?? null, dto.contato ?? null,
    );

    this.auditLog(tenantId, userId, 'laboratorio.criar', rows[0].id, { nome: dto.nome });
    return rows[0];
  }

  async toggleAtivo(tenantId: number, userId: number, id: number): Promise<Laboratorio> {
    const rows = await this.prisma.$queryRawUnsafe<Laboratorio[]>(
      `UPDATE laboratorios
       SET ativo = NOT ativo
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Laboratório ${id} não encontrado`);

    this.auditLog(tenantId, userId, 'laboratorio.toggle_ativo', id, { ativo: rows[0].ativo });
    return rows[0];
  }
}
