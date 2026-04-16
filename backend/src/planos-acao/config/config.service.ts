// backend/src/planos-acao/config/config.service.ts
import {
  Injectable, NotFoundException, ConflictException, UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCicloDto } from '../dto/create-ciclo.dto';
import { UpdateCicloDto } from '../dto/update-ciclo.dto';
import { CreateEtapaDto } from '../dto/create-etapa.dto';
import { UpdateEtapaDto } from '../dto/update-etapa.dto';
import { CreateCampoDto } from '../dto/create-campo.dto';
import { UpdateCampoDto } from '../dto/update-campo.dto';
import { CreateGatilhoDto } from '../dto/create-gatilho.dto';
import { UpdateGatilhoDto } from '../dto/update-gatilho.dto';

@Injectable()
export class ConfigPlanosAcaoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ciclos ──────────────────────────────────────────────────────────────────

  async listCiclos(tenantId: number, modulo?: string): Promise<any[]> {
    const filter = modulo
      ? `AND modulo = '${modulo.replace(/'/g, "''")}'`
      : '';
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c.*, json_agg(
         json_build_object(
           'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
           'cor', e.cor, 'is_inicial', e.is_inicial, 'is_final', e.is_final,
           'prazo_dias', e.prazo_dias, 'roles_transicao', e.roles_transicao
         ) ORDER BY e.ordem
       ) FILTER (WHERE e.id IS NOT NULL) AS etapas
       FROM pa_config_ciclo c
       LEFT JOIN pa_config_etapa e ON e.ciclo_id = c.id
       WHERE c.tenant_id = $1 ${filter}
       GROUP BY c.id
       ORDER BY c.id`,
      tenantId,
    );
  }

  async createCiclo(tenantId: number, dto: CreateCicloDto): Promise<any> {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_ciclo WHERE tenant_id = $1 AND modulo = $2 AND nome = $3`,
      tenantId, dto.modulo, dto.nome,
    );
    if (existing.length) {
      throw new ConflictException(`Já existe um ciclo "${dto.nome}" para o módulo ${dto.modulo}`);
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_ciclo (tenant_id, modulo, nome, descricao)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      tenantId, dto.modulo, dto.nome, dto.descricao ?? null,
    );
    return rows[0];
  }

  async updateCiclo(tenantId: number, cicloId: number, dto: UpdateCicloDto): Promise<any> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome      !== undefined) { sets.push(`nome = $${i++}`);      vals.push(dto.nome); }
    if (dto.descricao !== undefined) { sets.push(`descricao = $${i++}`); vals.push(dto.descricao); }
    if (dto.ativo     !== undefined) { sets.push(`ativo = $${i++}`);     vals.push(dto.ativo); }
    sets.push(`updated_at = NOW()`);
    vals.push(cicloId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_ciclo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteCiclo(tenantId: number, cicloId: number): Promise<void> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE pa_config_ciclo SET ativo = FALSE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      cicloId, tenantId,
    );
  }

  private async getCicloOuFalhar(tenantId: number, cicloId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_ciclo WHERE id = $1 AND tenant_id = $2`,
      cicloId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ciclo ${cicloId} não encontrado`);
    return rows[0];
  }

  // ── Etapas ──────────────────────────────────────────────────────────────────

  async listEtapas(tenantId: number, cicloId: number): Promise<any[]> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT e.*, json_agg(
         json_build_object(
           'id', c.id, 'nome', c.nome, 'chave', c.chave,
           'tipo', c.tipo, 'opcoes', c.opcoes, 'obrigatorio', c.obrigatorio, 'ordem', c.ordem
         ) ORDER BY c.ordem
       ) FILTER (WHERE c.id IS NOT NULL) AS campos
       FROM pa_config_etapa e
       LEFT JOIN pa_config_campo c ON c.etapa_id = e.id
       WHERE e.ciclo_id = $1 AND e.tenant_id = $2
       GROUP BY e.id
       ORDER BY e.ordem`,
      cicloId, tenantId,
    );
  }

  async createEtapa(tenantId: number, cicloId: number, dto: CreateEtapaDto): Promise<any> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_etapa
         (tenant_id, ciclo_id, nome, ordem, cor, is_inicial, is_final, prazo_dias, roles_transicao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[])
       RETURNING *`,
      tenantId, cicloId, dto.nome, dto.ordem,
      dto.cor ?? '#6B7280',
      dto.isInicial ?? false,
      dto.isFinal ?? false,
      dto.prazoDias ?? null,
      `{${(dto.rolesTransicao ?? []).join(',')}}`,
    );
    return rows[0];
  }

  async updateEtapa(tenantId: number, etapaId: number, dto: UpdateEtapaDto): Promise<any> {
    await this.getEtapaOuFalhar(tenantId, etapaId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome           !== undefined) { sets.push(`nome = $${i++}`);           vals.push(dto.nome); }
    if (dto.ordem          !== undefined) { sets.push(`ordem = $${i++}`);          vals.push(dto.ordem); }
    if (dto.cor            !== undefined) { sets.push(`cor = $${i++}`);            vals.push(dto.cor); }
    if (dto.isInicial      !== undefined) { sets.push(`is_inicial = $${i++}`);     vals.push(dto.isInicial); }
    if (dto.isFinal        !== undefined) { sets.push(`is_final = $${i++}`);       vals.push(dto.isFinal); }
    if (dto.prazoDias      !== undefined) { sets.push(`prazo_dias = $${i++}`);     vals.push(dto.prazoDias); }
    if (dto.rolesTransicao !== undefined) {
      sets.push(`roles_transicao = $${i++}::text[]`);
      vals.push(`{${dto.rolesTransicao.join(',')}}`);
    }
    vals.push(etapaId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_etapa SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteEtapa(tenantId: number, etapaId: number): Promise<void> {
    await this.getEtapaOuFalhar(tenantId, etapaId);
    // Check no PAs are currently in this stage
    const inUse = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_plano_acao WHERE etapa_atual_id = $1 AND deleted_at IS NULL LIMIT 1`,
      etapaId,
    );
    if (inUse.length) {
      throw new ConflictException('Não é possível remover etapa com PAs ativos nela');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM pa_config_etapa WHERE id = $1 AND tenant_id = $2`,
      etapaId, tenantId,
    );
  }

  private async getEtapaOuFalhar(tenantId: number, etapaId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_etapa WHERE id = $1 AND tenant_id = $2`,
      etapaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Etapa ${etapaId} não encontrada`);
    return rows[0];
  }

  // ── Campos ──────────────────────────────────────────────────────────────────

  async createCampo(tenantId: number, etapaId: number, dto: CreateCampoDto): Promise<any> {
    await this.getEtapaOuFalhar(tenantId, etapaId);
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_campo WHERE etapa_id = $1 AND chave = $2`,
      etapaId, dto.chave,
    );
    if (existing.length) {
      throw new ConflictException(`Campo com chave "${dto.chave}" já existe nesta etapa`);
    }
    const opcoesJson = dto.opcoes ? JSON.stringify(dto.opcoes) : null;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_campo (tenant_id, etapa_id, nome, chave, tipo, opcoes, obrigatorio, ordem)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING *`,
      tenantId, etapaId, dto.nome, dto.chave, dto.tipo,
      opcoesJson, dto.obrigatorio ?? false, dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateCampo(tenantId: number, campoId: number, dto: UpdateCampoDto): Promise<any> {
    const rows0 = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_campo WHERE id = $1 AND tenant_id = $2`,
      campoId, tenantId,
    );
    if (!rows0.length) throw new NotFoundException(`Campo ${campoId} não encontrado`);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome       !== undefined) { sets.push(`nome = $${i++}`);       vals.push(dto.nome); }
    if (dto.tipo       !== undefined) { sets.push(`tipo = $${i++}`);       vals.push(dto.tipo); }
    if (dto.opcoes     !== undefined) { sets.push(`opcoes = $${i++}::jsonb`); vals.push(JSON.stringify(dto.opcoes)); }
    if (dto.obrigatorio !== undefined) { sets.push(`obrigatorio = $${i++}`); vals.push(dto.obrigatorio); }
    if (dto.ordem      !== undefined) { sets.push(`ordem = $${i++}`);      vals.push(dto.ordem); }
    vals.push(campoId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_campo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteCampo(tenantId: number, campoId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_campo WHERE id = $1 AND tenant_id = $2`,
      campoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Campo ${campoId} não encontrado`);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM pa_config_campo WHERE id = $1 AND tenant_id = $2`,
      campoId, tenantId,
    );
  }

  // ── Gatilhos ────────────────────────────────────────────────────────────────

  async listGatilhos(tenantId: number, cicloId: number): Promise<any[]> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_gatilho WHERE tenant_id = $1 AND ciclo_id = $2 ORDER BY id`,
      tenantId, cicloId,
    );
  }

  async createGatilho(tenantId: number, cicloId: number, dto: CreateGatilhoDto): Promise<any> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    if (dto.condicao === 'TAXA_CONFORMIDADE_ABAIXO' && dto.valorLimiar === undefined) {
      throw new UnprocessableEntityException('valorLimiar é obrigatório para TAXA_CONFORMIDADE_ABAIXO');
    }
    if (dto.condicao === 'ITEM_CRITICO_NC' && !dto.criticidadeMin) {
      throw new UnprocessableEntityException('criticidadeMin é obrigatório para ITEM_CRITICO_NC');
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_gatilho (tenant_id, ciclo_id, modulo, condicao, valor_limiar, criticidade_min)
       VALUES ($1, $2, 'FVS', $3, $4, $5) RETURNING *`,
      tenantId, cicloId, dto.condicao,
      dto.valorLimiar ?? null, dto.criticidadeMin ?? null,
    );
    return rows[0];
  }

  async updateGatilho(tenantId: number, gatilhoId: number, dto: UpdateGatilhoDto): Promise<any> {
    const rows0 = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_gatilho WHERE id = $1 AND tenant_id = $2`,
      gatilhoId, tenantId,
    );
    if (!rows0.length) throw new NotFoundException(`Gatilho ${gatilhoId} não encontrado`);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.valorLimiar    !== undefined) { sets.push(`valor_limiar = $${i++}`);    vals.push(dto.valorLimiar); }
    if (dto.criticidadeMin !== undefined) { sets.push(`criticidade_min = $${i++}`); vals.push(dto.criticidadeMin); }
    if (dto.ativo          !== undefined) { sets.push(`ativo = $${i++}`);           vals.push(dto.ativo); }
    vals.push(gatilhoId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_gatilho SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteGatilho(tenantId: number, gatilhoId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_gatilho WHERE id = $1 AND tenant_id = $2`,
      gatilhoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Gatilho ${gatilhoId} não encontrado`);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM pa_config_gatilho WHERE id = $1 AND tenant_id = $2`,
      gatilhoId, tenantId,
    );
  }
}
