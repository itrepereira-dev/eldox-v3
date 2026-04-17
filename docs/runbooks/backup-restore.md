# Runbook — Backup e Restore do PostgreSQL (Eldox v3)

**Última atualização:** 2026-04-17
**Responsável:** Operações
**Requisito:** multi-tenant, dados de clientes em PBQP-H — **qualquer perda é inaceitável**.

---

## 1. Estratégia

- **O quê:** dump lógico completo (`pg_dump --clean --if-exists`) do banco `eldox_v3`.
- **Onde:** bucket MinIO `backups/postgres/` (mesmo VPS, **mas em volume separado**).
- **Quando:** diário às 03:00 UTC (cron dentro do container `eldox_v3_backup`).
- **Retenção:** 30 dias (aplicada automaticamente pelo `mc rm --older-than`).
- **Off-site:** ⚠️ **Pendente** — hoje o backup fica no mesmo VPS. Ver item 4.

Formato do arquivo: `eldox_v3_YYYY-MM-DDTHHMMSSZ.sql.gz`.

---

## 2. Smoke test mensal (OBRIGATÓRIO)

Todo dia 1º do mês, a Operações deve:

1. Listar backups:
   ```sh
   docker exec eldox_v3_backup mc ls minio/backups/postgres/
   ```
2. Baixar o backup mais recente:
   ```sh
   docker exec eldox_v3_backup mc cp \
     minio/backups/postgres/eldox_v3_*.sql.gz /tmp/last.sql.gz
   ```
3. Testar restore num banco efêmero (container Postgres descartável) — ver seção 3.
4. Registrar no `docs/runbooks/backup-test-log.md` (data, tamanho, duração).

Se o smoke-test falhar: abrir incidente 🔴 e não faça deploy até resolver.

---

## 3. Restore

### 3.1 Restore de emergência (produção quebrada)

> ⚠️ **Restore sobrescreve o banco atual. Faça snapshot do volume primeiro.**

```sh
# 1) Parar o backend para evitar writes durante o restore
docker stop eldox_v3_backend

# 2) Snapshot do volume atual (segurança)
docker run --rm \
  -v postgres_v3_data:/from \
  -v /tmp:/to \
  alpine tar czf /to/postgres_pre_restore.tgz /from

# 3) Baixar o backup desejado do MinIO
docker exec eldox_v3_backup \
  mc cp minio/backups/postgres/eldox_v3_2026-XX-XXTXXXXXXZ.sql.gz /tmp/restore.sql.gz

# 4) Copiar para o host e descomprimir
docker cp eldox_v3_backup:/tmp/restore.sql.gz /tmp/restore.sql.gz
gunzip -k /tmp/restore.sql.gz

# 5) Aplicar no Postgres
docker exec -i eldox_v3_postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB < /tmp/restore.sql

# 6) Verificar tabelas
docker exec eldox_v3_postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT count(*) FROM \"Tenant\";"

# 7) Reaplicar scripts RLS (Prisma migrations não reaplicam isso)
docker exec -i eldox_v3_postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB \
  < backend/prisma/rls/rls.sql

docker exec -i eldox_v3_postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB \
  < backend/prisma/rls/rls_rdo.sql

# 8) Reiniciar backend
docker start eldox_v3_backend

# 9) Validar healthcheck
curl -f https://$DOMAIN/api/v1/health
curl -f https://$DOMAIN/api/v1/ready
```

### 3.2 Restore para ambiente de teste (não destrutivo)

Crie um banco novo e aplique o dump nele:

```sh
docker run --rm --name pg_restore_test \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=restore_test \
  -p 5433:5432 -d postgres:16-alpine

gunzip -c last.sql.gz | docker exec -i pg_restore_test \
  psql -U postgres -d restore_test

docker stop pg_restore_test
```

---

## 4. Pendências conhecidas

- [ ] **Off-site backup** — replicar `backups/postgres/` para S3 (AWS/Backblaze) ou outro VPS. Hoje a perda total do VPS = perda do backup. Previsto para Sprint 2.
- [ ] **Alertas** — falha do cron não dispara alerta. Integrar com Uptime Kuma ou webhook Telegram. Previsto para Sprint 4 (observabilidade).
- [ ] **Backup do MinIO** — bucket `eldox-ged` (documentos) também precisa de backup off-site; hoje só o Postgres é backup-ado.

---

## 5. Trilha de auditoria

Logs do container: `docker logs eldox_v3_backup`.
Padrão das linhas: `[ISO8601] backup.<evento> <campos>`.
Eventos: `backup.start`, `backup.dumped`, `backup.uploaded`, `backup.retention_applied`, `backup.done`.
