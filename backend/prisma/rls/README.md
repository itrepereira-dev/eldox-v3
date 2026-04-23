# Row Level Security (RLS) — Eldox v3

## O que é RLS e por que está aqui

**Row Level Security** é um recurso nativo do PostgreSQL que restringe quais linhas de uma tabela cada conexão pode ver ou modificar — independentemente do código da aplicação. É uma camada de defesa em profundidade: mesmo que uma query esqueça o filtro `WHERE tenantId = ?`, o banco bloqueia o vazamento.

No Eldox v3 o modelo é **multi-tenant** com isolamento por `tenantId`. As políticas destes arquivos garantem que uma conexão autenticada como tenant `42` nunca enxergue dados do tenant `99`, mesmo sob falha de lógica na aplicação.

> **Por que não é uma migration Prisma?**
> O Prisma não tem suporte nativo para gerenciar políticas RLS (`CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Incluí-las no `schema.prisma` ou em migrations automáticas causaria conflitos ou seria ignorado silenciosamente. Por isso, estes scripts são aplicados **a cada deploy** pelo `docker-entrypoint.sh`, logo após `prisma migrate deploy`.

---

## Estado atual — INERTE até task #31

> **Atenção:** hoje a aplicação conecta no PostgreSQL como **SUPERUSER** (role padrão do Prisma). SUPERUSER bypassa RLS automaticamente, portanto as policies aqui definidas **não têm efeito em runtime**.
>
> Quando a task #31 migrar a aplicação para a role `eldox_app` (não-superuser) + middleware Prisma que faz `SET LOCAL app.tenant_id`, as policies começarão a valer **sem precisar de nenhuma migration adicional** — basta fazer o switch da connection string.
>
> Até lá, o trabalho destes scripts é:
> 1. Garantir que as policies estão versionadas e idempotentes.
> 2. Serem aplicadas a cada deploy (preparam o terreno).
> 3. Documentar cada tabela sensível com sua regra de isolamento.

---

## Arquivos de script

Todos os scripts são **idempotentes** (`DROP POLICY IF EXISTS` antes de `CREATE POLICY`) e podem ser re-executados sem efeitos colaterais.

| Arquivo | Cobertura |
|---|---|
| [`rls.sql`](./rls.sql) | Core: `Usuario`, `Obra`, `ObraLocal`, `ObraTipo`, módulo GED (14 tabelas), EldoxIA (5 tabelas), Gestão de Usuários (4 tabelas) |
| [`rls_rdo.sql`](./rls_rdo.sql) | Módulo RDO (Diário de Obra) — 11 tabelas |
| [`rls_fvs.sql`](./rls_fvs.sql) | Módulo FVS (Verificação de Serviços) — 16 tabelas |
| [`rls_fvm.sql`](./rls_fvm.sql) | Módulo FVM (Verificação de Materiais) — 15 tabelas |
| [`rls_ensaios.sql`](./rls_ensaios.sql) | Módulo Ensaios Laboratoriais — 9 tabelas |
| [`rls_almoxarifado.sql`](./rls_almoxarifado.sql) | Módulo Almoxarifado — 23 tabelas |
| [`rls_nc.sql`](./rls_nc.sql) | Módulo Não Conformidades (tabela central) — 1 tabela |
| [`rls_concretagem.sql`](./rls_concretagem.sql) | Módulo Concretagem — 9 tabelas |
| [`rls_efetivo.sql`](./rls_efetivo.sql) | Módulo Controle de Efetivo — 7 tabelas |
| [`rls_aprovacoes.sql`](./rls_aprovacoes.sql) | Workflow de Aprovações — 4 tabelas |
| [`rls_pa_ro_semaforo.sql`](./rls_pa_ro_semaforo.sql) | Planos de Ação + RO + Cache Semáforo PBQP-H — 11 tabelas |

---

## Padrão das policies

### Tenant estrito (maioria das tabelas)
```sql
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nome_tabela_tenant_isolation ON nome_tabela;
CREATE POLICY nome_tabela_tenant_isolation ON nome_tabela
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
```

### Tenant + dados de sistema (tenant_id = 0 global)
Para tabelas com seeds PBQP-H/SINAPI que todos os tenants devem ler:
```sql
CREATE POLICY nome_tabela_tenant_isolation ON nome_tabela
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);
```

Tabelas com essa variante:
- `ObraTipo`, `ged_workflow_templates`, `ged_categorias`
- `fvs_categorias_servico`, `fvs_catalogo_servicos`, `fvs_catalogo_itens`
- `fvm_categorias_materiais`, `fvm_catalogo_materiais`, `fvm_catalogo_itens`, `fvm_documentos_exigidos`, `fvm_normas_abnt`, `fvm_ensaio_templates`
- `alm_unidades_conversao`

### Relacionamento sem `tenant_id` próprio (JOIN com pai)
```sql
CREATE POLICY nome_tabela_tenant_isolation ON nome_tabela
  USING (EXISTS (
    SELECT 1 FROM tabela_pai p
    WHERE p.id = nome_tabela.pai_id
      AND current_setting('app.tenant_id', true)::int = p.tenant_id
  ));
```

Tabelas com essa variante:
- `perfil_permissoes` (JOIN com `perfis_acesso`)
- `alm_solicitacao_itens`, `alm_cotacao_itens`, `alm_oc_itens`, `alm_nfe_itens`, `alm_transferencia_itens`
- `workflow_template_etapas`

### Append-only (SELECT + INSERT, sem UPDATE/DELETE)
Audit logs imutáveis:
```sql
CREATE POLICY xxx_select ON xxx FOR SELECT
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
CREATE POLICY xxx_insert ON xxx FOR INSERT
  WITH CHECK (current_setting('app.tenant_id', true)::int = tenant_id);
```

Tabelas com essa variante:
- `rdo_log_edicoes`
- `fvs_audit_log`
- `efetivo_audit_log`

---

## Tabelas que NÃO têm RLS (intencional)

- **`sinapi_insumos`**: dados públicos da CAIXA Econômica Federal (tabela SINAPI). Sem `tenant_id`, leitura cross-tenant esperada.
- **`ged_pasta_config_tipos`**: lookup global de tipos de configuração de pasta.
- **`ged_workflow_steps`**: lookup acessado via `ged_workflow_templates` (que já tem RLS).
- **`ged_transmittal_itens`, `ged_transmittal_destinatarios`**: relacionamento de `ged_transmittals` (se necessário proteção, adicionar via JOIN numa revisão futura).
- **`ai_usage_log`**: observabilidade interna com `tenant_id` — em avaliação se deve ter policy ou se leitura cross-tenant facilita dashboards admin. Pendente de decisão.
- **`audit_log`** (core — append-only via trigger): tem `tenant_id`, mas a imutabilidade já é garantida por trigger no DB (`audit_log_append_only`). Pendente de adicionar policy de SELECT específica quando a task #31 ativar RLS.

---

## Como aplicar

Em produção, é automático via `docker-entrypoint.sh` a cada deploy. Para aplicar manualmente num banco local:

```bash
for f in backend/prisma/rls/*.sql; do
  echo "→ Aplicando $f"
  psql "$DATABASE_URL" -f "$f"
done
```

Para verificar se as policies foram criadas:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## SUPERUSER bypassa RLS automaticamente

O usuário utilizado pelo Prisma nas migrations e seeds deve ser `SUPERUSER` (ou ter `BYPASSRLS`). Nesse caso o PostgreSQL ignora as políticas RLS completamente — as migrations rodam sem precisar setar `app.tenant_id`.

Verifique o role da sua conexão:

```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

---

## Como testar após task #31

Assim que a aplicação migrar para a role `eldox_app` (não-superuser), este é o teste-chave para validar RLS:

```sql
-- 1. Conectar como eldox_app (sem BYPASSRLS)
SET ROLE eldox_app;

-- 2. Setar o tenant
BEGIN;
SET LOCAL app.tenant_id = '1';

-- 3. Ler — deve retornar APENAS registros do tenant 1
SELECT tenant_id, COUNT(*) FROM fvs_fichas GROUP BY tenant_id;
-- Esperado: 1 | <count>
-- Qualquer outro tenant_id aparecendo = BUG.

-- 4. Tentar ler sem tenant setado
ROLLBACK;
SELECT tenant_id, COUNT(*) FROM fvs_fichas GROUP BY tenant_id;
-- Esperado: 0 linhas (current_setting retorna NULL → cast falha → 0 linhas)

-- 5. Fora da task #31, conectar como SUPERUSER deve ver TUDO
-- independentemente de SET app.tenant_id (bypass).
```

### Middleware Prisma esperado (task #31)

```typescript
// prisma/middleware/rls.ts
prisma.$use(async (params, next) => {
  const tenantId = context.getTenantId(); // extraído do JWT/session
  await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
  return next(params);
});
```

> `SET LOCAL` tem escopo de **transação**: ao final o valor é descartado automaticamente, sem risco de vazamento entre requests no pool de conexões.

Se o tenant não for setado (ex.: rotas públicas), `current_setting('app.tenant_id', true)` retorna `NULL` e o cast para `int` falhará — resultando em zero linhas. Isso é o comportamento seguro (fail-closed).

---

## Re-aplicar / rollback

Todos os scripts são idempotentes: basta re-executar.

Para desabilitar RLS numa tabela específica (debug):

```sql
ALTER TABLE fvs_fichas DISABLE ROW LEVEL SECURITY;
```

Para remover uma policy específica:

```sql
DROP POLICY IF EXISTS fvs_fichas_tenant_isolation ON fvs_fichas;
```
