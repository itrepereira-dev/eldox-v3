// backend/src/ai/agents/fvs/agente-analise-foto.ts
// AGENTE-ANALISE-FOTO — vision AI: analisa foto de evidência e sugere status de conformidade
import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../../../ia/ia.service';

export interface AgenteAnaliseFotoCtx {
  tenant_id: number;
  usuario_id: number;
  registro_id: number;
  item_nome: string;
  servico_nome: string;
  criterio_conformidade?: string;
  image_base64: string;
  mime_type?: string;
}

export interface AnaliseFotoResult {
  status_sugerido: 'conforme' | 'nao_conforme' | 'nao_avaliado';
  confianca: number;         // 0.0 – 1.0
  observacoes: string;
  pontos_atencao: string[];
  fonte: 'ia' | 'fallback';
}

const SISTEMA = `Você é um inspetor de qualidade especialista em construção civil (PBQP-H).
Analise a foto de evidência e retorne JSON:
{
  "status_sugerido": "<conforme | nao_conforme | nao_avaliado>",
  "confianca": <0.0 a 1.0>,
  "observacoes": "<descrição objetiva do que é visível na foto>",
  "pontos_atencao": ["<item 1>", "<item 2>"]
}
Use "nao_avaliado" se a foto não permite conclusão clara.
Responda SOMENTE o JSON, sem markdown.`;

@Injectable()
export class AgenteAnaliseFoto {
  private readonly logger = new Logger(AgenteAnaliseFoto.name);
  private readonly MODELO = 'claude-sonnet-4-6';
  private readonly MAX_TOKENS = 800;

  constructor(private readonly iaService: IaService) {}

  async executar(ctx: AgenteAnaliseFotoCtx): Promise<AnaliseFotoResult> {
    try {
      const userMsg = `Item inspecionado: ${ctx.item_nome}
Serviço: ${ctx.servico_nome}
Critério de conformidade: ${ctx.criterio_conformidade ?? 'conforme especificação técnica'}`;

      // Claude vision: passa base64 como user message com imagem
      const texto = await this.iaService.callClaudeWithImage(
        this.MODELO,
        SISTEMA,
        userMsg,
        ctx.image_base64,
        ctx.mime_type ?? 'image/jpeg',
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.usuario_id,
        'fvs.analise_foto',
      );

      return { ...this.parse(texto), fonte: 'ia' };
    } catch (err) {
      this.logger.warn(`AGENTE-ANALISE-FOTO fallback (tenant=${ctx.tenant_id}): ${(err as Error).message}`);
      return this.fallback();
    }
  }

  private parse(texto: string): Omit<AnaliseFotoResult, 'fonte'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const p = JSON.parse(clean);
    const status = ['conforme', 'nao_conforme', 'nao_avaliado'].includes(p.status_sugerido)
      ? p.status_sugerido : 'nao_avaliado';
    return {
      status_sugerido: status,
      confianca: Math.max(0, Math.min(1, Number(p.confianca) || 0)),
      observacoes: String(p.observacoes ?? ''),
      pontos_atencao: Array.isArray(p.pontos_atencao) ? p.pontos_atencao.map(String) : [],
    };
  }

  private fallback(): AnaliseFotoResult {
    return { status_sugerido: 'nao_avaliado', confianca: 0, observacoes: 'Análise IA indisponível.', pontos_atencao: [], fonte: 'fallback' };
  }
}
