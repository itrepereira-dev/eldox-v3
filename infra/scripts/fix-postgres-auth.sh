#!/usr/bin/env bash
# ============================================================================
# fix-postgres-auth.sh — Diagnóstico + fix do incidente P1000 (backend down).
#
# Rodar na VPS como root:
#   curl -sSL https://raw.githubusercontent.com/itrepereira-dev/eldox-v3/main/infra/scripts/fix-postgres-auth.sh | bash
# OU (se já clonado):
#   bash /opt/eldox-v3/infra/scripts/fix-postgres-auth.sh
#
# O que faz:
#   1. Backup preventivo do Postgres (via pg_dumpall).
#   2. Compara POSTGRES_PASSWORD do .env com o env real do container.
#   3. Tenta conectar no Postgres com a senha do .env.
#   4. Se falha: oferece alinhar (resetar senha no container pra bater
#      com .env) após confirmação do operador.
#   5. Reinicia backend e valida via /api/v1/health.
#
# NÃO apaga volumes. NÃO muda outras configs. Idempotente.
# ============================================================================

set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

COMPOSE_DIR="${COMPOSE_DIR:-/opt/eldox-v3}"
COMPOSE_FILE="${COMPOSE_DIR}/infra/docker-compose.prod.yml"
ENV_FILE="${COMPOSE_DIR}/.env"
CONTAINER_PG="eldox_v3_postgres"
CONTAINER_BE="eldox_v3_backend"
HEALTH_URL="${HEALTH_URL:-https://sistema.eldox.com.br/api/v1/health}"

echo "${BOLD}${BLUE}══ fix-postgres-auth ══${RESET}"
echo "Compose: $COMPOSE_FILE"
echo "Env:     $ENV_FILE"
echo ""

# ── Pré-requisitos ──────────────────────────────────────────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  echo "${RED}✗ .env não encontrado em $ENV_FILE${RESET}" >&2
  exit 1
fi
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_PG}\$"; then
  echo "${RED}✗ container $CONTAINER_PG não existe — revise o deploy inicial${RESET}" >&2
  exit 1
fi

# ── 1. Backup preventivo ────────────────────────────────────────────────────

BACKUP_FILE="/tmp/pg-backup-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "${BOLD}[1/5] Backup Postgres${RESET} → $BACKUP_FILE"
if docker exec "$CONTAINER_PG" pg_isready -U postgres >/dev/null 2>&1; then
  docker exec "$CONTAINER_PG" pg_dumpall -U postgres 2>/dev/null | gzip > "$BACKUP_FILE" || {
    echo "${YELLOW}⚠ backup falhou (container pode estar inacessível) — prossigo com cautela${RESET}"
  }
  [[ -s "$BACKUP_FILE" ]] && echo "${GREEN}✓ backup $(du -h "$BACKUP_FILE" | awk '{print $1}')${RESET}" || echo "${YELLOW}⚠ backup vazio${RESET}"
else
  echo "${YELLOW}⚠ postgres não respondeu ao pg_isready — prossigo com cautela${RESET}"
fi
echo ""

# ── 2. Coletar valores ──────────────────────────────────────────────────────

ENV_USER=$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
ENV_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
ENV_PASS=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

CTN_USER=$(docker exec "$CONTAINER_PG" printenv POSTGRES_USER 2>/dev/null || echo '')
CTN_DB=$(docker exec "$CONTAINER_PG" printenv POSTGRES_DB 2>/dev/null || echo '')
CTN_PASS=$(docker exec "$CONTAINER_PG" printenv POSTGRES_PASSWORD 2>/dev/null || echo '')

echo "${BOLD}[2/5] Valores${RESET}"
printf "  %-20s .env=%-30s container=%s\n" "POSTGRES_USER" "${ENV_USER:-<vazio>}" "${CTN_USER:-<vazio>}"
printf "  %-20s .env=%-30s container=%s\n" "POSTGRES_DB"   "${ENV_DB:-<vazio>}"   "${CTN_DB:-<vazio>}"
printf "  %-20s .env=%-30s container=%s\n" "POSTGRES_PASSWORD" "$(echo -n "${ENV_PASS:-<vazio>}" | head -c 4)…(${#ENV_PASS} chars)" "$(echo -n "${CTN_PASS:-<vazio>}" | head -c 4)…(${#CTN_PASS} chars)"
echo ""

if [[ -z "$ENV_PASS" ]]; then
  echo "${RED}✗ POSTGRES_PASSWORD está VAZIO em $ENV_FILE${RESET}"
  echo "  Restaure o valor correto no .env antes de rodar este script."
  exit 1
fi

# ── 3. Testar conexão com a senha do .env ───────────────────────────────────

echo "${BOLD}[3/5] Testando conexão com senha do .env${RESET}"
TEST_OUTPUT=$(docker exec -e PGPASSWORD="$ENV_PASS" "$CONTAINER_PG" \
  psql -U "$ENV_USER" -d "$ENV_DB" -c "SELECT 1;" 2>&1 || true)

if echo "$TEST_OUTPUT" | grep -qi "authentication failed\|FATAL"; then
  echo "${RED}✗ .env não autentica${RESET}"
  NEEDS_FIX=1
elif echo "$TEST_OUTPUT" | grep -q "1 row\|?column?"; then
  echo "${GREEN}✓ .env autentica — não é problema de senha${RESET}"
  NEEDS_FIX=0
else
  echo "${YELLOW}⚠ resposta inesperada do psql:${RESET}"
  echo "$TEST_OUTPUT"
  NEEDS_FIX=1
fi
echo ""

# ── 4. Fix (se necessário) ──────────────────────────────────────────────────

if [[ "$NEEDS_FIX" == "1" ]]; then
  echo "${BOLD}[4/5] Fix${RESET}"
  echo "O container Postgres parece ter outra senha salva no volume."
  echo "Posso forçar ALTER USER no Postgres pra bater com a senha do .env."
  echo ""
  read -p "Prosseguir com o ALTER USER? [s/N] " ans
  if [[ "$ans" =~ ^[sSyY]$ ]]; then
    # Descobrir a senha atual do container (do volume) para autenticar
    # Tenta usar a senha que o container expõe via printenv — é a que o Postgres
    # foi configurado na inicialização, mas o volume pode ter sido alterado.
    # Última saída: superuser postgres + peer auth localhost.
    if docker exec "$CONTAINER_PG" psql -U postgres -c \
         "ALTER USER \"$ENV_USER\" WITH PASSWORD '$ENV_PASS';" >/dev/null 2>&1; then
      echo "${GREEN}✓ senha alinhada via superuser postgres${RESET}"
    else
      echo "${RED}✗ não conseguiu conectar nem como superuser postgres${RESET}"
      echo "  Tente manualmente:"
      echo "    docker exec -it $CONTAINER_PG bash"
      echo "    psql -U postgres"
      echo "    ALTER USER \"$ENV_USER\" WITH PASSWORD '<senha_do_env>';"
      exit 1
    fi
  else
    echo "${YELLOW}⚠ fix cancelado${RESET}"
    exit 0
  fi
else
  echo "${BOLD}[4/5] Fix${RESET}"
  echo "Senha OK no .env. Problema pode ser outro. Verifique:"
  echo "  docker logs --tail 80 $CONTAINER_BE"
  exit 0
fi
echo ""

# ── 5. Reiniciar backend + validar ──────────────────────────────────────────

echo "${BOLD}[5/5] Reiniciando backend${RESET}"
cd "$COMPOSE_DIR"
docker compose -f "$COMPOSE_FILE" up -d backend

echo "Aguardando backend ficar healthy (até 90s)..."
for i in $(seq 1 18); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_BE" 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    echo "${GREEN}✓ backend healthy (tentativa $i)${RESET}"
    break
  fi
  sleep 5
done

if [[ "$STATUS" != "healthy" ]]; then
  echo "${RED}✗ backend não ficou healthy em 90s${RESET}"
  echo "  Últimas linhas do log:"
  docker logs --tail 30 "$CONTAINER_BE"
  exit 1
fi

echo ""
echo "${BOLD}Smoke test externo${RESET}"
RESP=$(curl -s "$HEALTH_URL" || echo 'curl_failed')
if echo "$RESP" | grep -q '"status":"ok"'; then
  echo "${GREEN}✓ $HEALTH_URL → $RESP${RESET}"
  echo ""
  echo "${GREEN}${BOLD}══ SISTEMA RESTAURADO ══${RESET}"
  echo "Backup preventivo salvo em: $BACKUP_FILE"
else
  echo "${RED}✗ health externo falhou: $RESP${RESET}"
  echo "  Verifique Traefik: docker logs --tail 30 coolify-proxy"
fi
