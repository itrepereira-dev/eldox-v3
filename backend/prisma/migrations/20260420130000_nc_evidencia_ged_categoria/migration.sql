-- Migration: nc_evidencia_ged_categoria
-- Data:      2026-04-20
-- Objetivo:  Criar categoria GED "EVIDENCIA_NC" (tenant_id=0) para que
--            o upload direto de foto na tela de NC consiga criar documento
--            no GED automaticamente, reusando o fluxo já existente.
--
-- Regra PBQP-H: evidência de NC precisa estar no GED (rastreabilidade +
-- audit log). Antes desta migration o campo ged_versao_id em
-- nao_conformidades existia (migration 20260420000200), mas o único
-- jeito de preenchê-lo era uploading manualmente no GED primeiro e
-- depois vinculando — atrito UX inaceitável.
--
-- Categoria NÃO requer workflow (igual a FOTO_RDO) — evidência de NC é
-- fato fotografado, não documento controlado.

INSERT INTO ged_categorias
  (tenant_id, nome, codigo, escopo_padrao, requer_aprovacao, prazo_revisao_dias, workflow_default_id)
VALUES
  (0, 'Evidência de Não Conformidade', 'EVIDENCIA_NC', 'OBRA', false, NULL, NULL)
ON CONFLICT (tenant_id, codigo) DO NOTHING;
