// src/obras/strategies/linear.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarLinearDto } from '../dto/gerar-cascata.dto';

@Injectable()
export class LinearStrategy implements ILocalGenerator {
  async gerar(payload: GerarLinearDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { obraId, tenantId, obraCodigo, tx } = ctx;
    const trechos = payload.trechos;
    const elementos = payload.elementos ?? [];
    const prefixoPV = payload.prefixoPV ?? 'PV';

    // Anti-DoS
    const totalEstimado = trechos.reduce((acc, t) => acc + 1 + (t.pvs ?? 0), 0) + elementos.length;
    if (totalEstimado > 10000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${totalEstimado} locais. Limite: 10.000 por vez.`,
      );
    }

    const locais: GerarCascataResult['locais'] = [];
    let inseridos = 0;
    const trechoMap: Record<string, number> = {}; // nome → id

    for (let idx = 0; idx < trechos.length; idx++) {
      const tr = trechos[idx];
      const trechoNome = tr.nome || `Trecho ${idx + 1}`;
      const kmInicio = tr.kmInicio ?? null;
      const kmFim = tr.kmFim ?? null;
      const extensaoM =
        kmInicio !== null && kmFim !== null
          ? Math.round(Math.abs(kmFim - kmInicio) * 1000 * 100) / 100
          : null;

      const trecho = await tx.obraLocal.create({
        data: {
          tenantId,
          obraId,
          parentId: null,
          nivel: 1,
          nome: trechoNome,
          nomeCompleto: trechoNome,
          codigo: `${obraCodigo}-TR${String(idx + 1).padStart(2, '0')}`,
          ordem: idx,
          dadosExtras: { kmInicio, kmFim, extensaoM },
        },
      });
      locais!.push({ id: trecho.id, nome: trecho.nome, nomeCompleto: trecho.nomeCompleto, nivel: 1 });
      inseridos++;
      trechoMap[trechoNome] = trecho.id;

      // Gerar PVs
      const numPVs = tr.pvs ?? 0;
      if (numPVs > 0) {
        const pvData = Array.from({ length: numPVs }, (_, pvIdx) => {
          const pvNum = pvIdx + 1;
          const pvNome = `${prefixoPV}-${String(pvNum).padStart(3, '0')}`;
          const pvNomeCompleto = `${trechoNome} > ${pvNome}`;
          let pvKm: number | null = null;
          if (kmInicio !== null && kmFim !== null && numPVs > 1) {
            pvKm =
              Math.round(
                (kmInicio + ((kmFim - kmInicio) * pvIdx) / (numPVs - 1)) * 10000,
              ) / 10000;
          }
          return {
            tenantId,
            obraId,
            parentId: trecho.id,
            nivel: 2,
            nome: pvNome,
            nomeCompleto: pvNomeCompleto,
            codigo: `${trecho.codigo}-${pvNome}`,
            ordem: pvIdx,
            dadosExtras: { km: pvKm },
          };
        });
        await tx.obraLocal.createMany({ data: pvData });
        inseridos += pvData.length;
        // createMany não retorna IDs — não empurrar locais com id: 0
      }
    }

    // Elementos avulsos
    for (let eIdx = 0; eIdx < elementos.length; eIdx++) {
      const elem = elementos[eIdx];
      if (!elem.nome) continue;
      const elemParentId = elem.trecho ? (trechoMap[elem.trecho] ?? null) : null;
      const elemNivel = elemParentId !== null ? 2 : 1;
      const elemNomeCompleto =
        elemParentId !== null ? `${elem.trecho} > ${elem.nome}` : elem.nome;

      const local = await tx.obraLocal.create({
        data: {
          tenantId,
          obraId,
          parentId: elemParentId,
          nivel: elemNivel,
          nome: elem.nome,
          nomeCompleto: elemNomeCompleto,
          codigo: `${obraCodigo}-EL${String(eIdx + 1).padStart(3, '0')}`,
          ordem: 9000 + eIdx,
          dadosExtras: { km: elem.km ?? null },
        },
      });
      locais!.push({
        id: local.id,
        nome: local.nome,
        nomeCompleto: local.nomeCompleto,
        nivel: elemNivel,
      });
      inseridos++;
    }

    return { inseridos, locais };
  }
}
