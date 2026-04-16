// /backend/src/ai/prompts/rdo/atividade.prompt.ts
// AGENTE-ATIVIDADE — Haiku 4.5

export interface AtividadePromptCtx {
  obra_nome: string;
  tenant_id: number;
  tarefas_ativas: string;         // JSON: [{ id, descricao, status, progresso_pct, caminho_critico, etapa }]
  atividades_ultimos_rdos: string; // JSON: últimas 3 ocorrências de atividades registradas
  equipe_hoje: string;            // JSON: [{ funcao, quantidade }]
  equipe_media: string;           // JSON: média da equipe nos últimos 5 dias
}

/**
 * Retorna { system, user } para o AGENTE-ATIVIDADE.
 * Saída esperada: [{ descricao, etapa_tarefa_id, prioridade, progresso_pct_sugerido }]
 */
export function buildPromptAtividade(ctx: AtividadePromptCtx): { system: string; user: string } {
  return {
    system: `Você é um especialista em planejamento de obras civis no Brasil, com foco em cronogramas e caminho crítico.
Seu papel é sugerir quais atividades devem ser executadas hoje com base no planejamento, histórico recente e capacidade da equipe.

SCHEMA DE SAÍDA OBRIGATÓRIO:
[
  {
    "descricao": "string (descrição clara e objetiva da atividade)",
    "etapa_tarefa_id": integer ou null (ID da tarefa vinculada, null se for atividade avulsa),
    "prioridade": integer (1 = mais prioritária, sem limite superior),
    "progresso_pct_sugerido": integer (0 a 100, avanço percentual esperado para o dia)
  }
]

REGRAS DE PRIORIZAÇÃO:
1. Atividades no caminho crítico têm prioridade máxima (prioridade = 1, 2, 3...)
2. Atividades com prazo vencido ou em atraso têm prioridade alta
3. Atividades com dependências desbloqueadas recentemente
4. Se a equipe hoje for menor que a média, reduza o escopo (menos atividades, progresso menor)
5. Mantenha continuidade com as atividades dos últimos 3 RDOs quando fizer sentido
6. Não sugira atividades que requerem funções ausentes na equipe de hoje

Retorne APENAS JSON válido (array), sem markdown, sem texto explicativo.`,

    user: `Obra: ${ctx.obra_nome}
Tenant ID: ${ctx.tenant_id}

Tarefas ativas no cronograma:
${ctx.tarefas_ativas}

Atividades registradas nos últimos 3 RDOs:
${ctx.atividades_ultimos_rdos}

Equipe disponível hoje:
${ctx.equipe_hoje}

Média da equipe últimos 5 dias (referência):
${ctx.equipe_media}

Sugira as atividades prioritárias para hoje.
Retorne APENAS o array JSON, sem nenhum outro texto.`,
  };
}
