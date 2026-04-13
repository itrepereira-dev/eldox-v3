import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarGenericaDto } from '../dto/gerar-cascata.dto';

@Injectable()
export class GenericaStrategy implements ILocalGenerator {
  async gerar(payload: GerarGenericaDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { niveis } = payload;
    const { obraId, tenantId, obraCodigo, tx } = ctx;

    // Anti-DoS: estimativa do produto dos quantitativos
    const totalEstimado = niveis.reduce((acc, n) => acc * n.qtde, 1);
    if (totalEstimado > 5000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${totalEstimado} locais. Limite: 5.000 por vez.`,
      );
    }

    const todosLocais: GerarCascataResult['locais'] = [];

    // Começa recursão a partir de pais nulos (raiz)
    await this.gerarNivel(niveis, 0, null, '', obraCodigo, obraId, tenantId, tx, {
      locais: todosLocais,
    });

    const totalInseridos = todosLocais.length;

    return { inseridos: totalInseridos, locais: todosLocais };
  }

  private async gerarNivel(
    niveis: GerarGenericaDto['niveis'],
    nivelIdx: number,
    parentId: number | null,
    parentNomeCompleto: string,
    parentCodigo: string,
    obraId: number,
    tenantId: number,
    tx: GerarCascataContext['tx'],
    acc: { locais: GerarCascataResult['locais'] },
  ): Promise<void> {
    if (nivelIdx >= niveis.length) return;

    const cfg = niveis[nivelIdx];
    const inicioEm = cfg.inicioEm ?? 1;

    // Conta existentes para ordenação
    const ordemBase = await tx.obraLocal.count({
      where: { obraId, parentId: parentId ?? null, deletadoEm: null },
    });

    // Cria todos os locais desse nível de uma vez
    const data = Array.from({ length: cfg.qtde }, (_, i) => {
      const seq = inicioEm + i;
      const nome = `${cfg.prefixo} ${String(seq).padStart(2, '0')}`;
      const nomeCompleto = parentNomeCompleto ? `${parentNomeCompleto} > ${nome}` : nome;
      const codigoSufixo = `${cfg.prefixo.substring(0, 1).toUpperCase()}${String(seq).padStart(2, '0')}`;
      const codigo = `${parentCodigo}-${codigoSufixo}`;

      return {
        tenantId,
        obraId,
        parentId,
        nivel: cfg.nivel,
        nome,
        nomeCompleto,
        codigo,
        ordem: ordemBase + i,
        // tipoUnidade não existe como coluna — vai em dadosExtras
        ...(cfg.tipoUnidade ? { dadosExtras: { tipoUnidade: cfg.tipoUnidade } } : {}),
      };
    });

    await tx.obraLocal.createMany({ data });

    // Busca os IDs recém-criados para descer recursivamente
    const criados = await tx.obraLocal.findMany({
      where: { obraId, parentId: parentId ?? null, nivel: cfg.nivel, deletadoEm: null },
      orderBy: { ordem: 'asc' },
      select: { id: true, nome: true, nomeCompleto: true, codigo: true, nivel: true },
      take: cfg.qtde,
      skip: ordemBase,
    });

    acc.locais!.push(...criados);

    // Desce para o próximo nível em cada pai criado
    if (nivelIdx + 1 < niveis.length) {
      for (const criado of criados) {
        await this.gerarNivel(
          niveis, nivelIdx + 1,
          criado.id, criado.nomeCompleto, criado.codigo,
          obraId, tenantId, tx, acc,
        );
      }
    }
  }
}
