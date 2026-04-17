#!/bin/sh
# =============================================================================
# Eldox v3 — Backend entrypoint
# =============================================================================
# Fluxo:
#   1. Aplica migrations Prisma pendentes (idempotente — só roda as novas).
#   2. Aplica scripts RLS (idempotente — DROP POLICY IF EXISTS antes de CREATE).
#   3. Inicia o servidor NestJS.
#
# Falha-rápida (set -e): se qualquer etapa falhar, o container NÃO sobe.
# Isso protege contra deploys com schema inconsistente.
# =============================================================================

set -eu

log() {
  echo "[entrypoint] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

log "start"

# ── 1. Prisma migrate ───────────────────────────────────────────────────────
log "prisma.migrate_deploy.start"
npx prisma migrate deploy
log "prisma.migrate_deploy.done"

# ── 2. Row Level Security ───────────────────────────────────────────────────
# Usa `prisma db execute` em vez de psql — aceita a mesma DATABASE_URL das
# migrations (incluindo `?schema=public`) sem precisar de postgresql-client
# no container. Em dev/test local pode ser pulado via SKIP_RLS=1.
if [ "${SKIP_RLS:-0}" = "1" ]; then
  log "rls.skipped (SKIP_RLS=1)"
else
  for f in prisma/rls/rls.sql prisma/rls/rls_rdo.sql; do
    if [ -f "$f" ]; then
      log "rls.apply file=$f"
      npx prisma db execute --file "$f" --schema prisma/schema.prisma
    else
      log "rls.missing file=$f"
    fi
  done
  log "rls.done"
fi

# ── 3. Inicia servidor ──────────────────────────────────────────────────────
log "server.start"
exec node dist/src/main
