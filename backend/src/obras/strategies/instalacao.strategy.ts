// src/obras/strategies/instalacao.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarInstalacaoDto } from '../dto/gerar-cascata.dto';

@Injectable()
export class InstalacaoStrategy implements ILocalGenerator {
  async gerar(payload: GerarInstalacaoDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { obraId, tenantId, obraCodigo, tx } = ctx;
    const areas = payload.areas;

    // Anti-DoS
    const totalEstimado = areas.reduce(
      (acc, a) => acc + 1 + a.modulos.reduce((m, mod) => m + Math.max(1, mod.qtde ?? 1), 0),
      0,
    );
    if (totalEstimado > 10000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${totalEstimado} locais. Limite: 10.000 por vez.`,
      );
    }

    const locais: NonNullable<GerarCascataResult['locais']> = [];
    let inseridos = 0;

    for (let aIdx = 0; aIdx < areas.length; aIdx++) {
      const area = areas[aIdx];
      const areaNome = area.nome || `Área ${aIdx + 1}`;

      const areaLocal = await tx.obraLocal.create({
        data: {
          tenantId, obraId, parentId: null, nivel: 1,
          nome: areaNome, nomeCompleto: areaNome,
          codigo: `${obraCodigo}-AR${String(aIdx + 1).padStart(2, '0')}`,
          ordem: aIdx,
        },
      });
      locais.push({ id: areaLocal.id, nome: areaLocal.nome, nomeCompleto: areaLocal.nomeCompleto, nivel: 1 });
      inseridos++;

      let ordemMod = 0;
      for (const mod of area.modulos) {
        if (mod.nome) {
          // Módulo com nome exato
          const local = await tx.obraLocal.create({
            data: {
              tenantId, obraId, parentId: areaLocal.id, nivel: 2,
              nome: mod.nome, nomeCompleto: `${areaNome} > ${mod.nome}`,
              codigo: `${areaLocal.codigo}-${mod.nome.substring(0, 3).toUpperCase()}${String(ordemMod).padStart(2, '0')}`,
              ordem: ordemMod++,
            },
          });
          locais.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: 2 });
          inseridos++;
        } else if (mod.prefixo) {
          // Módulos numerados
          const qtde = mod.qtde ?? 1;
          const modData = Array.from({ length: qtde }, (_, i) => {
            const modNome = `${mod.prefixo} ${String(i + 1).padStart(2, '0')}`;
            return {
              tenantId, obraId, parentId: areaLocal.id, nivel: 2,
              nome: modNome, nomeCompleto: `${areaNome} > ${modNome}`,
              codigo: `${areaLocal.codigo}-${String(i + 1).padStart(2, '0')}`,
              ordem: ordemMod++,
            };
          });
          await tx.obraLocal.createMany({ data: modData });
          inseridos += modData.length;
          // createMany não retorna IDs — não empurrar locais com id: 0
        }
      }
    }

    return { inseridos, locais };
  }
}
