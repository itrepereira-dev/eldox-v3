#!/bin/bash
# =============================================================================
# Eldox v3 — Reset Produção
# =============================================================================
# Reinicia a produção do zero: derruba containers, apaga volumes (dados),
# gera secrets novos, sobe tudo limpo e cria o tenant admin inicial.
#
# USO (na VPS como root):
#   curl -fsSL https://raw.githubusercontent.com/itrepereira-dev/eldox-v3/main/infra/scripts/reset-prod.sh | bash
#
# OU, se quiser baixar e revisar antes:
#   curl -fsSLO https://raw.githubusercontent.com/itrepereira-dev/eldox-v3/main/infra/scripts/reset-prod.sh
#   bash reset-prod.sh
#
# Pré-requisitos:
#   - Pasta /opt/eldox-v3/infra/ existe com docker-compose.prod.yml
#   - docker + docker compose instalados
#   - openssl disponível
#   - Chave Anthropic em mãos (sk-ant-...) — será solicitada interativamente
#   - Email + senha do admin — será solicitado interativamente
#
# O QUE FAZ:
#   1. Pede chave Anthropic + dados do admin (interativo, sem echo da chave)
#   2. docker compose down (mantém imagens)
#   3. Apaga volumes postgres/minio/redis
#   4. Gera secrets novos (JWT, Postgres, MinIO) via openssl
#   5. Reescreve /opt/eldox-v3/infra/.env
#   6. docker compose pull + up -d
#   7. Aguarda backend healthy
#   8. Cria tenant admin via /api/v1/auth/register
#   9. Seed do template workflow RDO (aprovação padrão)
# =============================================================================

set -euo pipefail

INFRA_DIR="/opt/eldox-v3/infra"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
ENV_FILE="$INFRA_DIR/.env"
DOMAIN="sistema.eldox.com.br"

echo "======================================"
echo " Eldox v3 — Reset Producao"
echo "======================================"
echo ""

# ── Validacao de pre-requisitos ──────────────────────────────────────────────
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERRO: $COMPOSE_FILE nao encontrado"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERRO: docker nao instalado"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERRO: openssl nao instalado"
  exit 1
fi

# ── Input interativo ─────────────────────────────────────────────────────────
echo "ATENCAO: esta operacao APAGA todos os dados de producao."
echo "         (Postgres, MinIO, Redis) — irreversivel."
echo ""
read -p "Confirma reset completo digitando 'RESET PROD': " CONFIRMA
if [ "$CONFIRMA" != "RESET PROD" ]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "── Credenciais a serem configuradas ───────────────────────────"
read -s -p "Chave Anthropic (nao vai aparecer na tela): " ANTHROPIC_KEY
echo ""
if [ -z "$ANTHROPIC_KEY" ]; then
  echo "ERRO: chave Anthropic nao pode ficar vazia"
  exit 1
fi

echo ""
echo "── Admin inicial do sistema ───────────────────────────────────"
read -p "Nome do tenant (ex: Eldox): " TENANT_NOME
TENANT_NOME=${TENANT_NOME:-Eldox}

read -p "Slug do tenant (ex: eldox): " TENANT_SLUG
TENANT_SLUG=${TENANT_SLUG:-eldox}

read -p "Seu nome: " ADMIN_NOME
read -p "Seu email: " ADMIN_EMAIL
read -s -p "Senha do admin (min 10 chars, 1 especial): " ADMIN_SENHA
echo ""

if [ ${#ADMIN_SENHA} -lt 10 ]; then
  echo "ERRO: senha precisa ter pelo menos 10 caracteres"
  exit 1
fi

echo ""
echo "Ok, confirmando antes de iniciar:"
echo "  Tenant: $TENANT_NOME ($TENANT_SLUG)"
echo "  Admin:  $ADMIN_NOME <$ADMIN_EMAIL>"
echo ""
read -p "Tudo certo? (s/N): " CONFIRM_FINAL
if [ "$CONFIRM_FINAL" != "s" ] && [ "$CONFIRM_FINAL" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

# ── Backup do .env atual ─────────────────────────────────────────────────────
echo ""
echo "[1/9] Backup do .env atual..."
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_FILE.pre-reset-$(date +%Y%m%d-%H%M%S)"
  echo "       ok (salvo em $ENV_FILE.pre-reset-*)"
fi

# ── Parar containers ────────────────────────────────────────────────────────
echo "[2/9] Parando containers v3..."
cd /opt/eldox-v3
docker compose -f "$COMPOSE_FILE" down || true

# ── Apagar volumes ──────────────────────────────────────────────────────────
echo "[3/9] Apagando volumes v3..."
docker volume rm infra_postgres_v3_data 2>/dev/null || true
docker volume rm infra_minio_v3_data 2>/dev/null || true
docker volume rm infra_redis_v3_data 2>/dev/null || true
echo "       ok"

# ── Gerar secrets ───────────────────────────────────────────────────────────
echo "[4/9] Gerando secrets novos..."
PG_PASS=$(openssl rand -base64 36 | tr -d '=+/' | cut -c1-32)
JWT_SEC=$(openssl rand -hex 32)
JWT_REF=$(openssl rand -hex 32)
MINIO_AK=$(openssl rand -hex 10)
MINIO_SK=$(openssl rand -hex 24)

# ── Reescrever .env ─────────────────────────────────────────────────────────
echo "[5/9] Reescrevendo .env..."
cat > "$ENV_FILE" <<ENVEOF
DOMAIN=$DOMAIN
GITHUB_REPO=itrepereira-dev/eldox-v3

POSTGRES_DB=eldox_v3
POSTGRES_USER=eldox_v3
POSTGRES_PASSWORD=$PG_PASS

JWT_SECRET=$JWT_SEC
JWT_REFRESH_SECRET=$JWT_REF
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d

MINIO_ACCESS_KEY=$MINIO_AK
MINIO_SECRET_KEY=$MINIO_SK
MINIO_BUCKET=eldox-ged

ANTHROPIC_API_KEY=$ANTHROPIC_KEY
ENVEOF
chmod 600 "$ENV_FILE"

# Limpa variaveis da memoria
unset PG_PASS JWT_SEC JWT_REF MINIO_AK MINIO_SK ANTHROPIC_KEY

echo "       ok ($(wc -l < "$ENV_FILE") linhas)"

# ── Pull + up ───────────────────────────────────────────────────────────────
echo "[6/9] Pull das imagens (pode levar 1-2 min)..."
docker compose -f "$COMPOSE_FILE" pull

echo "[7/9] Subindo containers..."
docker compose -f "$COMPOSE_FILE" up -d

# ── Aguardar backend healthy ────────────────────────────────────────────────
echo "[8/9] Aguardando backend ficar healthy (migrations rodando)..."
HEALTHY=0
for i in $(seq 1 30); do
  sleep 4
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' eldox_v3_backend 2>/dev/null || echo "starting")
  echo "       tentativa $i/30: $STATUS"
  if [ "$STATUS" = "healthy" ]; then
    HEALTHY=1
    break
  fi
done

if [ "$HEALTHY" -ne 1 ]; then
  echo ""
  echo "ERRO: backend nao ficou healthy em 2 min."
  echo "Logs:"
  docker logs --tail 50 eldox_v3_backend 2>&1 | tail -50
  exit 1
fi

# ── Criar tenant admin ──────────────────────────────────────────────────────
echo "[9/9] Criando tenant admin via API..."
HTTP_CODE=$(curl -s -o /tmp/register-response.json -w "%{http_code}" \
  -X POST "https://$DOMAIN/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSONEOF
{
  "tenantNome": "$TENANT_NOME",
  "tenantSlug": "$TENANT_SLUG",
  "adminNome": "$ADMIN_NOME",
  "adminEmail": "$ADMIN_EMAIL",
  "adminSenha": "$ADMIN_SENHA"
}
JSONEOF
)")

unset ADMIN_SENHA

if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
  echo "       ERRO ($HTTP_CODE):"
  cat /tmp/register-response.json
  echo ""
  echo "O sistema esta no ar, mas falhou em criar o admin automaticamente."
  echo "Voce pode criar manualmente depois via POST /api/v1/auth/register"
  exit 1
fi

echo "       admin criado com sucesso"

# ── Seed template workflow RDO ──────────────────────────────────────────────
echo ""
echo "Bonus: criando template de aprovacao RDO default..."
docker exec -i eldox_v3_postgres psql -U eldox_v3 -d eldox_v3 >/dev/null <<'SQLEOF'
INSERT INTO workflow_templates (tenant_id, nome, modulo, descricao, ativo)
VALUES (1, 'RDO — Aprovação padrão', 'RDO', 'Template default: engenheiro aprova em 48h', true);

INSERT INTO workflow_template_etapas (template_id, ordem, nome, tipo_aprovador, role, prazo_horas, acao_vencimento, acao_rejeicao)
VALUES (
  (SELECT id FROM workflow_templates WHERE modulo='RDO' AND tenant_id=1 ORDER BY id DESC LIMIT 1),
  1,
  'Aprovação do Engenheiro',
  'ROLE',
  'ENGENHEIRO',
  48,
  'ESCALAR',
  'RETORNAR_SOLICITANTE'
);
SQLEOF

echo ""
echo "======================================"
echo " RESET CONCLUIDO"
echo "======================================"
echo ""
echo "Sistema no ar em: https://$DOMAIN"
echo "Login: $ADMIN_EMAIL"
echo "Tenant slug: $TENANT_SLUG"
echo ""
echo "Smoke test:"
echo "  curl https://$DOMAIN/api/v1/health"
echo ""
