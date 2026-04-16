// /backend/src/ai/prompts/rdo/campo.prompt.ts
// AGENTE-CAMPO — Sonnet 4.6 (entrada via WhatsApp — plano Corporativo)

export interface CampoPromptCtx {
  tenant_id: number;
  obra_id: number;
  obra_nome: string;
  numero_whatsapp: string;
  usuario_nome: string;
  mensagem_texto: string;
  transcricao_audio?: string;  // Transcrição de áudio (se houver)
  fotos_descricao?: string;    // Descrição/metadados das fotos enviadas (base64 processado)
  historico_conversa?: string; // Últimas 3 mensagens da conversa (contexto)
  data_hoje: string;           // ISO 8601
}

/**
 * Retorna { system, user } para o AGENTE-CAMPO.
 * Saída: { acao, rdo_id, resumo_para_usuario, campos_extraidos }
 */
export function buildPromptCampo(ctx: CampoPromptCtx): { system: string; user: string } {
  const audioSection = ctx.transcricao_audio
    ? `\nTranscrição do áudio enviado:\n${ctx.transcricao_audio}`
    : '';

  const fotosSection = ctx.fotos_descricao
    ? `\nFotos recebidas (metadados/descrição):\n${ctx.fotos_descricao}`
    : '';

  const historicoSection = ctx.historico_conversa
    ? `\nHistórico recente da conversa:\n${ctx.historico_conversa}`
    : '';

  return {
    system: `Você é o assistente de campo do Eldox, um sistema de gestão de obras civis no Brasil.
Você recebe mensagens via WhatsApp de engenheiros, mestres de obra e técnicos no canteiro.
Sua tarefa é interpretar a mensagem e extrair dados estruturados para criar ou atualizar um RDO.

SCHEMA DE SAÍDA OBRIGATÓRIO:
{
  "acao": "rascunho_criado" | "solicitar_confirmacao" | "erro",
  "rdo_id": integer ou null,
  "resumo_para_usuario": "string (resposta amigável para enviar de volta ao WhatsApp — máx 300 chars)",
  "campos_extraidos": {
    "data": "string ISO 8601 ou null",
    "clima": {
      "manha": "claro|nublado|chuvoso|null",
      "tarde": "claro|nublado|chuvoso|null",
      "noite": "claro|nublado|chuvoso|null"
    } ou null,
    "equipe": [{ "funcao": "string", "quantidade": integer }] ou [],
    "atividades": [{ "descricao": "string", "progresso_pct": integer ou null }] ou [],
    "ocorrencias": [{ "descricao": "string", "tipo": "string" }] ou [],
    "materiais": [{ "nome": "string", "quantidade": "string" }] ou [],
    "observacoes": "string ou null"
  }
}

REGRAS DE INTERPRETAÇÃO:
- Se a mensagem é clara e suficiente → acao: "rascunho_criado"
- Se a mensagem está incompleta ou ambígua → acao: "solicitar_confirmacao" + faça UMA pergunta clara no resumo_para_usuario
- Se a mensagem não é relacionada a RDO ou obra → acao: "erro" + oriente educadamente no resumo_para_usuario
- Interprete linguagem informal brasileira ("pedreiro" = função Pedreiro, "choveu hoje" = clima chuvoso)
- Transcrições de áudio podem ter erros — use contexto para corrigir
- Datas relativas: "hoje", "ontem", "segunda" → converter para data absoluta baseado em data_hoje
- "resumo_para_usuario" deve ser natural, como uma resposta de WhatsApp (pode usar emojis simples)

Retorne APENAS JSON válido, sem markdown, sem texto explicativo.`,

    user: `Obra: ${ctx.obra_nome} (ID: ${ctx.obra_id})
Usuário: ${ctx.usuario_nome} (WhatsApp: ${ctx.numero_whatsapp})
Tenant ID: ${ctx.tenant_id}
Data de hoje: ${ctx.data_hoje}

Mensagem recebida:
${ctx.mensagem_texto}${audioSection}${fotosSection}${historicoSection}

Interprete a mensagem e extraia os dados do RDO.
Retorne APENAS o objeto JSON, sem nenhum outro texto.`,
  };
}
