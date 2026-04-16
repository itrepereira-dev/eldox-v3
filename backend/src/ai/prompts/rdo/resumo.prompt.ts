// /backend/src/ai/prompts/rdo/resumo.prompt.ts
// AGENTE-RESUMO — Sonnet 4.6

export interface ResumoPromptCtx {
  obra_nome: string;
  tenant_id: number;
  data_rdo: string;              // ex: "2026-04-14"
  rdo_aprovado_json: string;     // RDO completo aprovado serializado
  historico_obra: string;        // Contexto histórico (prazos, fase, ocorrências relevantes)
  template_comentario: string;   // Template configurado pelo tenant (pode ser vazio)
}

/**
 * Retorna { system, user } para o AGENTE-RESUMO.
 * Saída: texto de 3-5 linhas em linguagem técnica profissional.
 */
export function buildPromptResumo(ctx: ResumoPromptCtx): { system: string; user: string } {
  const templateInstrucao = ctx.template_comentario
    ? `\nSiga o seguinte template fornecido pelo gestor da obra:\n${ctx.template_comentario}\n`
    : '\nNão há template específico. Use formato livre técnico profissional.\n';

  return {
    system: `Você é um engenheiro civil sênior com vasta experiência em gestão de obras no Brasil.
Sua tarefa é redigir o comentário técnico de encerramento de um Relatório Diário de Obra (RDO).

INSTRUÇÕES DE ESCRITA:
- Linguagem técnica, clara e objetiva (norma culta brasileira)
- Extensão: 3 a 5 linhas (não mais, não menos)
- Mencione: atividades executadas, condições climáticas, efetivo presente, ocorrências relevantes
- Se houver atraso ou improdutividade, mencione de forma objetiva e documental
- Evite redundâncias com os campos já preenchidos — o comentário deve AGREGAR contexto
- Não use bullets, listas, markdown ou formatação especial — apenas parágrafos
- Tom: relatório técnico profissional (não coloquial, não excessivamente formal)
${templateInstrucao}
Retorne APENAS o texto do comentário, sem JSON, sem markdown, sem aspas envolventes.`,

    user: `Obra: ${ctx.obra_nome}
Data do RDO: ${ctx.data_rdo}
Tenant ID: ${ctx.tenant_id}

RDO completo aprovado:
${ctx.rdo_aprovado_json}

Contexto histórico da obra:
${ctx.historico_obra}

Redija o comentário técnico de encerramento deste RDO.
Retorne APENAS o texto, sem formatação adicional.`,
  };
}
