#!/bin/sh
# =============================================================================
# PostgreSQL daily backup → MinIO (bucket `backups`) com retenção de 30 dias.
# Roda dentro do container `eldox_v3_backup` via cron (03:00 UTC).
# =============================================================================
set -eu

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILENAME="eldox_v3_${STAMP}.sql.gz"
LOCAL_PATH="/tmp/${FILENAME}"
REMOTE_PATH="backups/postgres/${FILENAME}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup.start file=${FILENAME}"

# 1) Dump comprimido
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-eldox-v3-postgres}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "${LOCAL_PATH}"

SIZE="$(du -h "${LOCAL_PATH}" | cut -f1)"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup.dumped size=${SIZE}"

# 2) Upload para MinIO — cria o bucket na primeira execução
mc alias set minio "http://${MINIO_ENDPOINT:-eldox-v3-minio}:9000" \
  "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" >/dev/null 2>&1

mc mb --ignore-existing "minio/${BACKUP_BUCKET:-backups}" >/dev/null 2>&1 || true
mc cp "${LOCAL_PATH}" "minio/${BACKUP_BUCKET:-backups}/postgres/${FILENAME}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup.uploaded remote=${REMOTE_PATH}"

# 3) Retenção — apaga arquivos com mais de 30 dias
mc rm --recursive --force --older-than "30d" \
  "minio/${BACKUP_BUCKET:-backups}/postgres/" || true

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup.retention_applied days=30"

# 4) Limpeza local
rm -f "${LOCAL_PATH}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup.done"
