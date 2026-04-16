// /backend/src/ai/agents/rdo/index.ts
// Barrel export — todos os agentes RDO

export { AgenteClima } from './agente-clima';
export type { AgenteClimaCtx, AgenteClimaResult } from './agente-clima';

export { AgenteEquipe } from './agente-equipe';
export type { AgenteEquipeCtx, AgenteEquipeResult, EquipeSugestao } from './agente-equipe';

export { AgenteAtividade } from './agente-atividade';
export type { AgenteAtividadeCtx, AgenteAtividadeResult, AtividadeSugestao } from './agente-atividade';

export { AgenteValidador } from './agente-validador';
export type { AgenteValidadorCtx, AgenteValidadorResult, Inconsistencia } from './agente-validador';

export { AgenteResumo } from './agente-resumo';
export type { AgenteResumoCtx, AgenteResumoResult } from './agente-resumo';

export { AgenteAlerta } from './agente-alerta';
export type { AgenteAlertaCtx, AgenteAlertaResult, AlertaRdo } from './agente-alerta';

export { AgenteCampo } from './agente-campo';
export type { AgenteCampoCtx, AgenteCampoResult, CamposExtraidos } from './agente-campo';
