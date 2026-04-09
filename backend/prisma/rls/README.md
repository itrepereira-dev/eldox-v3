# Row Level Security (RLS) — Eldox v3

## O que é RLS e por que está aqui

**Row Level Security** é um recurso nativo do PostgreSQL que restringe quais linhas de uma tabela cada conexão pode ver ou modificar — independentemente do código da aplicação. É uma camada de defesa em profundidade: mesmo que uma query esqueça o filtro `WHERE tenantId = ?`, o banco bloqueia o vazamento.

No Eldox v3 o modelo é **multi-tenant** com isolamento por `tenantId`. As políticas deste arquivo garantem que uma conexão autenticada como tenant `42` nunca enxergue dados do tenant `99`, mesmo sob falha de lógica na aplicação.

> **Por que não é uma migration Prisma?**
> O Prisma não tem suporte nativo para gerenciar políticas RLS (`CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Incluí-las no `schema.prisma` ou em migrations automáticas causaria conflitos ou seria ignorado silenciosamente. Por isso, este script é aplicado **manualmente uma única vez** após as migrations, e deve ser versionado aqui junto com o restante do schema.

---

## Tabelas protegidas

| Tabela      | Regra                                                              |
|-------------|--------------------------------------------------------------------|
| `Usuario`   | Somente registros onde `tenantId` = tenant da sessão              |
| `Obra`      | Somente registros onde `tenantId` = tenant da sessão              |
| `ObraLocal` | Somente registros onde `tenantId` = tenant da sessão              |
| `ObraTipo`  | Registros do sistema (`tenantId = 0`) **ou** do tenant da sessão  |

---

## Como aplicar

Execute uma única vez no banco de destino (desenvolvimento, staging ou produção):

```bash
psql $DATABASE_URL -f prisma/migrations/rls/rls.sql
```

Para verificar se as políticas foram criadas:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## SUPERUSER bypassa RLS automaticamente

O usuário utilizado pelo Prisma nas migrations e seeds deve ser `SUPERUSER` (ou ter `BYPASSRLS`). Nesse caso o PostgreSQL ignora as políticas RLS completamente — as migrations rodam sem precisar setar `app.tenant_id`.

Verifique o role da sua conexão de migration:

```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

---

## Como o app deve usar em produção

A cada request autenticado, o middleware do Prisma deve setar o tenant antes de qualquer query:

```typescript
// prisma/middleware/rls.ts
prisma.$use(async (params, next) => {
  const tenantId = context.getTenantId(); // extraído do JWT/session
  await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
  return next(params);
});
```

> `SET LOCAL` tem escopo de **transação**: ao final da transação o valor é descartado automaticamente, sem risco de vazamento entre requests no pool de conexões.

Se o tenant não for setado (ex.: rotas públicas), `current_setting('app.tenant_id', true)` retorna `NULL` e o cast para `int` falhará — resultando em zero linhas retornadas. Isso é o comportamento seguro (fail-closed).

---

## Re-aplicar / rollback

Para remover as políticas:

```sql
DROP POLICY IF EXISTS tenant_isolation ON "Usuario";
DROP POLICY IF EXISTS tenant_isolation ON "Obra";
DROP POLICY IF EXISTS tenant_isolation ON "ObraLocal";
DROP POLICY IF EXISTS tenant_isolation ON "ObraTipo";

ALTER TABLE "Usuario"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Obra"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ObraLocal" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ObraTipo"  DISABLE ROW LEVEL SECURITY;
```

Para re-aplicar após alterações no script, faça o rollback acima e rode `rls.sql` novamente.
