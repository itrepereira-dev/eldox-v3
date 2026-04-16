// /backend/src/ai/prompts/rdo/equipe.prompt.ts
// AGENTE-EQUIPE — Haiku 4.5

export interface EquipePromptCtx {
  obra_nome: string;
  dia_semana: string;         // ex: "segunda-feira"
  historico_rdos: string;     // JSON serializado dos últimos 7 RDOs (funcao + quantidade)
  tenant_id: number;
}

/**
 * Retorna { system, user } para o AGENTE-EQUIPE.
 * Saída esperada: [{ funcao: string, quantidade: int, confianca: float }]
 */
export function buildPromptEquipe(ctx: EquipePromptCtx): { system: string; user: string } {
  return {
    system: `Você é um assistente especializado em gestão de equipes em canteiros de obra no Brasil.
Seu papel é analisar o histórico de mobilização de equipes e sugerir a composição mais provável para o dia atual.

SCHEMA DE SAÍDA OBRIGATÓRIO:
[
  {
    "funcao": "string (ex: Pedreiro, Armador, Carpinteiro, Servente, Eletricista, Encanador)",
    "quantidade": integer (>= 1),
    "confianca": float (0.0 a 1.0, onde 1.0 = certeza absoluta)
  }
]

REGRAS:
- Considere sazonalidade semanal (segunda-feira pode ter absenteísmo maior)
- Considere padrões de dia da semana no histórico fornecido
- Se um dia da semana historicamente tem menos equipe, reduza confiança
- Retorne APENAS JSON válido (array), sem markdown, sem texto explicativo
- Não invente funções que nunca apareceram no histórico
- Quantidade mínima: 1 por função sugerida
- Confiança: use o desvio padrão do histórico para calibrar (alta variação = baixa confiança)`,

    user: `Obra: ${ctx.obra_nome}
Dia da semana: ${ctx.dia_semana}
Tenant ID: ${ctx.tenant_id}

Histórico de equipes nos últimos 7 RDOs (JSON):
${ctx.historico_rdos}

Com base neste histórico, sugira a composição de equipe para hoje.
Retorne APENAS o array JSON, sem nenhum outro texto.`,
  };
}
