// src/obras/strategies/edificacao.strategy.ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ILocalGenerator, GerarCascataContext, GerarCascataResult } from './base-generator.strategy';
import { GerarEdificacaoDto } from '../dto/gerar-cascata.dto';

type TX = GerarCascataContext['tx'];

@Injectable()
export class EdificacaoStrategy implements ILocalGenerator {
  // Templates de áreas comuns por bloco
  private readonly templatesPorBloco: Record<string, (numAndares: number) => { nome: string; tipo: string }[]> = {
    halls:      (n) => Array.from({ length: Math.max(1, n) }, (_, i) => ({ nome: `Hall Pav ${i + 1}`, tipo: 'area_comum' })),
    escadas:    ()  => [{ nome: 'Escada', tipo: 'area_comum' }],
    elevadores: ()  => [{ nome: 'Eixo Elevador 1', tipo: 'tecnica' }, { nome: 'Casa de Máquinas Elevador', tipo: 'tecnica' }],
    fachadas:   ()  => ['Norte', 'Sul', 'Leste', 'Oeste'].map((f) => ({ nome: `Fachada ${f}`, tipo: 'estrutural' })),
    cobertura:  ()  => [{ nome: 'Cobertura', tipo: 'estrutural' }, { nome: "Caixa d'água", tipo: 'tecnica' }],
    garagem:    ()  => [{ nome: 'Garagem Subsolo', tipo: 'area_comum' }, { nome: 'Rampa de Acesso', tipo: 'area_comum' }],
  };

  // Templates de áreas globais por condomínio
  private readonly templatesGlobais: Record<string, { nome: string; tipo: string }[]> = {
    lazer:    [
      { nome: 'Piscina', tipo: 'area_comum' }, { nome: 'Salão de Festas', tipo: 'area_comum' },
      { nome: 'Churrasqueira', tipo: 'area_comum' }, { nome: 'Playground', tipo: 'area_comum' },
      { nome: 'Academia', tipo: 'area_comum' },
    ],
    sistemas: [
      { nome: 'Casa de Bombas', tipo: 'tecnica' }, { nome: 'Gerador', tipo: 'tecnica' },
      { nome: 'QGBT/Subestação', tipo: 'tecnica' }, { nome: 'Guarita', tipo: 'area_comum' },
      { nome: 'Portão de Acesso', tipo: 'area_comum' },
    ],
  };

  async gerar(payload: GerarEdificacaoDto, ctx: GerarCascataContext): Promise<GerarCascataResult> {
    const { obraId, tenantId, obraCodigo, tx } = ctx;
    const condQtd = payload.condQtd ?? 1;
    const blocoQtd = payload.blocoQtd;
    const andarQtd = payload.andarQtd ?? 0;
    const unidadesAndar = payload.unidadesAndar ?? 0;
    const unidadesTotal = payload.unidadesTotal ?? 0;

    // Anti-DoS
    const unidPorBloco = payload.modo === 'andar'
      ? andarQtd * unidadesAndar
      : unidadesTotal;
    const estimativa = condQtd * blocoQtd * (andarQtd + unidPorBloco + 30) + condQtd * 15;
    if (estimativa > 10000) {
      throw new UnprocessableEntityException(
        `Configuração geraria ~${estimativa} locais. Limite: 10.000 por vez.`,
      );
    }

    const locais: GerarCascataResult['locais'] = [];
    let inseridos = 0;
    const usaCondominio = !!payload.condPrefixo;
    const condInicio = payload.condInicio ?? 1;

    for (let c = 0; c < condQtd; c++) {
      let condParentId: number | null = null;
      let condNomeCompleto = '';
      let nivelBloco = 1;

      // Cria condomínio se necessário
      if (usaCondominio) {
        const condNum = condInicio + c;
        const condNome = condQtd === 1 ? payload.condPrefixo! : `${payload.condPrefixo} ${condNum}`;
        const cond = await tx.obraLocal.create({
          data: {
            tenantId, obraId, parentId: null, nivel: 1,
            nome: condNome, nomeCompleto: condNome,
            codigo: `${obraCodigo}-C${String(condNum).padStart(2, '0')}`,
            ordem: c,
          },
        });
        locais!.push({ id: cond.id, nome: cond.nome, nomeCompleto: cond.nomeCompleto, nivel: 1 });
        inseridos++;
        condParentId = cond.id;
        condNomeCompleto = condNome;
        nivelBloco = 2;

        // Áreas globais do condomínio
        for (const area of payload.areasGlobais ?? []) {
          const items = this.templatesGlobais[area] ?? [];
          for (const item of items) {
            const local = await tx.obraLocal.create({
              data: {
                tenantId, obraId, parentId: condParentId, nivel: nivelBloco,
                nome: item.nome, nomeCompleto: `${condNomeCompleto} > ${item.nome}`,
                codigo: `${obraCodigo}-C${c + 1}-${item.nome.substring(0, 3).toUpperCase()}`,
                ordem: 9000 + inseridos,
              },
            });
            locais!.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: nivelBloco });
            inseridos++;
          }
        }
      }

      // Cria blocos
      for (let b = 0; b < blocoQtd; b++) {
        const blocoLabel = payload.blocoTipo === 'letra'
          ? String.fromCharCode((payload.blocoLetraInicio ?? 'A').charCodeAt(0) + b)
          : String((payload.blocoNumInicio ?? 1) + b);
        const blocoNome = `${payload.blocoPrefixo} ${blocoLabel}`;
        const blocoNomeCompleto = condNomeCompleto ? `${condNomeCompleto} > ${blocoNome}` : blocoNome;

        const bloco = await tx.obraLocal.create({
          data: {
            tenantId, obraId, parentId: condParentId, nivel: nivelBloco,
            nome: blocoNome, nomeCompleto: blocoNomeCompleto,
            codigo: `${obraCodigo}-${blocoLabel}`,
            ordem: b,
          },
        });
        locais!.push({ id: bloco.id, nome: bloco.nome, nomeCompleto: bloco.nomeCompleto, nivel: nivelBloco });
        inseridos++;

        const nivelAndar = nivelBloco + 1;
        const nivelUnidade = nivelAndar + 1;
        const andarInicio = payload.andarInicio ?? 1;

        if (payload.modo === 'andar') {
          // Cria andares e unidades por andar
          for (let a = 0; a < andarQtd; a++) {
            const andarNum = andarInicio + a;
            const andarNome = `${andarNum}º Pavimento`;
            const andarNomeCompleto = `${blocoNomeCompleto} > ${andarNome}`;

            const andar = await tx.obraLocal.create({
              data: {
                tenantId, obraId, parentId: bloco.id, nivel: nivelAndar,
                nome: andarNome, nomeCompleto: andarNomeCompleto,
                codigo: `${bloco.codigo}-P${String(andarNum).padStart(2, '0')}`,
                ordem: a,
              },
            });
            locais!.push({ id: andar.id, nome: andar.nome, nomeCompleto: andar.nomeCompleto, nivel: nivelAndar });
            inseridos++;

            // Unidades por andar
            const unidData = Array.from({ length: unidadesAndar }, (_, u) => {
              const unidNum = andarNum * 100 + u + 1;
              const unidNome = `${payload.unidadePrefixo ?? 'AP'} ${unidNum}`;
              return {
                tenantId, obraId, parentId: andar.id, nivel: nivelUnidade,
                nome: unidNome, nomeCompleto: `${andarNomeCompleto} > ${unidNome}`,
                codigo: `${andar.codigo}-${String(unidNum).padStart(3, '0')}`,
                ordem: u,
              };
            });
            await tx.obraLocal.createMany({ data: unidData });
            inseridos += unidData.length;
            // createMany não retorna IDs — não empurrar locais com id: 0
          }
        } else {
          // Modo sequencial — unidades sem nível de andar
          const unidData = Array.from({ length: unidadesTotal }, (_, u) => {
            const unidNum = u + 1;
            const unidNome = `${payload.unidadePrefixo ?? 'AP'} ${String(unidNum).padStart(3, '0')}`;
            return {
              tenantId, obraId, parentId: bloco.id, nivel: nivelAndar,
              nome: unidNome, nomeCompleto: `${blocoNomeCompleto} > ${unidNome}`,
              codigo: `${bloco.codigo}-${String(unidNum).padStart(3, '0')}`,
              ordem: u,
            };
          });
          await tx.obraLocal.createMany({ data: unidData });
          inseridos += unidData.length;
          // createMany não retorna IDs — não empurrar locais com id: 0
        }

        // Áreas comuns por bloco
        for (const area of payload.areasComuns ?? []) {
          const items = this.templatesPorBloco[area]?.(andarQtd) ?? [];
          for (const item of items) {
            const local = await tx.obraLocal.create({
              data: {
                tenantId, obraId, parentId: bloco.id, nivel: nivelAndar,
                nome: item.nome, nomeCompleto: `${blocoNomeCompleto} > ${item.nome}`,
                codigo: `${bloco.codigo}-${item.nome.substring(0, 3).toUpperCase()}`,
                ordem: 8000 + inseridos,
              },
            });
            locais!.push({ id: local.id, nome: local.nome, nomeCompleto: local.nomeCompleto, nivel: nivelAndar });
            inseridos++;
          }
        }
      }
    }

    return { inseridos, locais };
  }
}
