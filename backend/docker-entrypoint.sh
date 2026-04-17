#!/bin/sh
# =============================================================================
# Eldox v3 — Backend entrypoint
# =============================================================================
# Fluxo:
#   1. Aplica migrations Prisma pendentes (idempotente — só roda as novas).
#   2. Aplica scripts RLS (idempotente — DROP POLICY IF EXISTS antes de CREATE).
#   3. Inicia o servidor NestJS.
#
# Falha-rápido (set -e): se qualquer etapa falhar, o container NÃO sobe.
# Isso protege contra deploys com schema inconsistente.
# =============================================================================

set -e

echo "[entrypoint] $(date -u +%Y-%m-%dT%H:%M:%SZ) — start"

# ── 1. Prisma migrate ───────────────────────────────────────────────────────
echo "[entrypoint] prisma.migrate_deploy.start"
npx prisma migrate deploy
echo "[entrypoint] prisma.migrate_deploy.done"

# ── 2. Row Level Security ───────────────────────────────────────────────────
# Requer psql no container + DATABASE_URL com permissão de SUPERUSER (ou role
# dona das tabelas). Em dev/test local o RLS pode ser pulado via SKIP_RLS=1.
if [ "${SKIP_RLS:-0}" = "1" ]; then
  echo "[entrypoint] rls.skipped (SKIP_RLS=1)"
else
  for f in prisma/rls/rls.sql prisma/rls/rls_rdo.sql; do
    if [ -f "$f" ]; then
      echo "[entrypoint] rls.apply file=$f"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" > /dev/null
    else
      echo "[entrypoint] rls.missing file=$f"
    fi
  done
  echo "[entrypoint] rls.done"
fi

# ── 3. Inicia servidor ──────────────────────────────────────────────────────
echo "[entrypoint] server.start"
exec node dist/src/main
