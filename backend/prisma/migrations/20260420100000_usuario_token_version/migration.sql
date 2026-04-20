-- =============================================================================
-- Migration: usuario_token_version
-- =============================================================================
-- Adiciona campo token_version ao Usuario — usado para revogação de JWT.
--
-- Como funciona:
--   1. JWT payload passa a incluir `v: token_version` (access e refresh).
--   2. JwtStrategy consulta usuario.token_version e compara com payload.v.
--   3. Se divergir → 401 (token revogado).
--   4. Incrementa em:
--        - reset-senha (self)                → invalida todos os tokens antigos
--        - admin gera reset-senha             → idem (prevenção se conta compromet.)
--        - definirAtivo(false)                → força logout imediato
--
-- Usuários existentes começam em 1; JWTs emitidos ANTES desta migration
-- foram assinados sem `v` (undefined). Compatibilidade: JwtStrategy trata
-- payload.v ausente como aceito (bootstrap de transição). Após deploy, todo
-- novo token carrega v e a comparação passa a valer.
--
-- Rollback:
--   ALTER TABLE "Usuario" DROP COLUMN "token_version";
-- =============================================================================

ALTER TABLE "Usuario"
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 1;
