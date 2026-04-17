# ADR-001: Almoxarifado como Recurso do Tenant

**Status:** Proposto
**Data:** 2026-04-17
**Autores:** Orquestrador Eldox

---

## Contexto

### Estado atual

O módulo Almoxarifado do Eldox está estruturado por obra (`obraId`). Cada obra possui:

- **`alm_estoque_saldo`** — saldo por `(tenant_id, obra_id, catalogo_id, local_id)`.
- **`alm_movimentos`** — ledger imutável de entradas, saídas, transferências e perdas, vinculado à obra.
- **`alm_estoque_locais`** — locais físicos de armazenagem, criados por obra.
- **`alm_alertas_estoque`** — alertas de estoque mínimo por obra.
- **`alm_solicitacoes` / `alm_solicitacao_itens`** — pedidos de materiais iniciados por obra.
- **`alm_ordens_compra` / `alm_oc_itens`** — ordens de compra emitidas por obra.
- **`alm_notas_fiscais` / `alm_nfe_itens`** — NF-e recebidas e vinculadas a obra/OC.

O catálogo de materiais (`fvm_catalogo_materiais`) já é nível tenant. Os demais artefatos são estritamente obra-scoped.

### Pontos de dor

1. **Sem visão consolidada de estoque.** Um gestor de tenant precisa abrir cada obra individualmente para ver o que sobra ou falta.
2. **Transferência atual é gambeta.** O método `transferir()` em `EstoqueService` debita a obra origem e credita a obra destino em uma única transação, mas não cria nenhum registro rastreável de transferência — apenas dois movimentos avulsos com `referencia_tipo = 'transferencia'`. Não há link entre eles, nem aprovação, nem status.
3. **Custo de material (CPV) disperso.** Não existe uma tabela de CPV. O custo por obra é calculado somando `alm_oc_itens.preco_unitario * qtd_recebida`, o que ignora material que entrou sem OC e não permite análise de lucratividade por empreendimento.
4. **Compras duplicadas.** Quando duas obras precisam do mesmo material, cada uma emite sua própria OC. Um pool compartilhado permitiria compra centralizada com alocação posterior.
5. **Impossibilidade de relatório de CPV consolidado.** Sem agregação no nível tenant, relatórios de rentabilidade do negócio são inviáveis sem exportar e consolidar dados manualmente.

---

## Decisão

Elevar o Almoxarifado para recurso de tenant, criando um pool global de estoque (`alm_estoque_global`) que pertence ao tenant, e permitindo alocação controlada desse pool para obras específicas (`alm_alocacoes`) com rastreabilidade completa de custo (tabela `alm_cpv`).

As tabelas existentes (`alm_estoque_saldo`, `alm_movimentos`) permanecem como ledger histórico por obra, mas o saldo autoritativo passa a ser derivado do pool global. A migração é aditiva: novas tabelas são criadas, dados existentes são migrados, e as rotas antigas são mantidas (deprecadas) por 90 dias.

---

## Alternativas Consideradas

### Opção A: Manter por obra (status quo)

**Descrição:** Não alterar o modelo. Melhorar apenas a UI de transferência para gerar dois movimentos rastreáveis linkados por UUID.

**Prós:**
- Zero risco de migration.
- Zero breaking change para clientes existentes.
- Implementação em dias.

**Contras:**
- Impossibilita visão consolidada de estoque real por tenant.
- Impede compras centralizadas (uma OC que abastece múltiplas obras).
- CPV por obra continuaria sendo soma de OC, sem suporte a material recebido sem OC, ajustes de inventário ou perdas.
- Transferência ainda seria semanticamente falha (dois movimentos independentes sem entidade de transferência).
- Débito técnico cresce: toda feature futura de BI ou relatório precisará agregar manualmente.

**Veredicto:** Rejeitada.

---

### Opção B: Stock tenant-level com alocação por obra (ESCOLHIDA)

**Descrição:** Criar pool global de estoque no nível tenant. Entradas de material vão direto ao pool. Obras consomem do pool via alocações. Transferências entre obras são realocações com auditoria completa. CPV é registrado no momento da consumação pelo obra.

**Prós:**
- Visão consolidada real de estoque para o gestor do tenant.
- Compra centralizada: uma OC pode alimentar `n` obras.
- Transferência entre obras vira uma entidade de primeiro nível (`alm_transferencias`) com status, aprovação e rastreabilidade.
- CPV por obra passa a ser uma tabela dedicada (`alm_cpv`) alimentada em tempo real, pronta para relatórios de rentabilidade.
- Alerta de estoque mínimo pode operar no nível tenant (ex: "cimento acabando em todo o portfólio").
- Planejamento de compras pode cruzar demandas de todas as obras simultaneamente.

**Contras:**
- Migration complexa: dados obra-scoped precisam ser migrados para o pool global com atribuição de origem.
- Breaking change nas rotas `obras/:obraId/estoque/*` — o contrato de saldo muda (passa a refletir saldo alocado, não saldo próprio).
- Maior complexidade de negócio: é necessário definir política de alocação (reserva vs. consumo direto).
- Frontend precisa de nova tela "Almoxarifado Central" e adaptação das telas por obra.
- Risco de concorrência: duas alocações simultâneas do mesmo item podem tentar exceder o saldo global — requer lock otimista ou `SELECT FOR UPDATE` no pool.

**Veredicto:** Escolhida.

---

### Opção C: Stock tenant-level sem alocação por obra

**Descrição:** Um único saldo global por material, sem rastreamento de qual obra consumiu o quê. Obras simplesmente fazem saídas do pool.

**Prós:**
- Modelo mais simples (sem tabela `alm_alocacoes`).
- Migration mais direta.

**Contras:**
- Perde completamente a rastreabilidade de custo por obra — impossibilita CPV por empreendimento.
- Impede relatório de quanto cada obra gastou em material.
- Impossibilita análise de desvio de orçamento por obra.
- Sem alocação, não é possível reservar material para uma obra antes de despachá-lo fisicamente.

**Veredicto:** Rejeitada.

---

## Impacto

### Modelo de dados (delta)

Novas tabelas criadas (detalhes completos na spec `2026-04-17-almoxarifado-tenant-spec.md`):

| Tabela | Responsabilidade |
|--------|-----------------|
| `alm_item_catalogo_tenant` | Vista materializada do catálogo por tenant (índices de consumo, ponto de pedido calculado) |
| `alm_estoque_global` | Saldo global por `(tenant_id, catalogo_id)` — pool compartilhado |
| `alm_alocacoes` | Reserva/alocação de quantidade do pool para uma obra específica |
| `alm_transferencias` | Entidade de transferência entre obras (com status e aprovação) |
| `alm_cpv` | Registro de custo na consumação por obra (Custo do Produto Vendido) |

Tabelas existentes alteradas:

| Tabela | Mudança |
|--------|---------|
| `alm_estoque_saldo` | Campo `saldo_global_id` adicionado (FK para `alm_estoque_global`) |
| `alm_movimentos` | Campo `alocacao_id` adicionado (FK opcional para `alm_alocacoes`) |
| `alm_movimentos` | Campo `transferencia_id` adicionado (FK opcional para `alm_transferencias`) |
| `alm_ordens_compra` | Campo `obra_id` passa a ser `NULLABLE` (OC de tenant sem obra específica) |

### Breaking changes

1. **`GET /almoxarifado/obras/:obraId/estoque`** — O saldo retornado passa a ser o saldo alocado (não o saldo do pool). Clientes que assumiam que o saldo era "propriedade" da obra podem ver números menores.
2. **`POST /almoxarifado/obras/:obraId/estoque/movimentos`** com `tipo: 'entrada'` — Entradas passam a ser feitas no pool (`POST /almoxarifado/estoque/entrada`) e então alocadas. Entradas diretas por obra são deprecadas e redirecionadas internamente (entrada no pool + alocação automática para a obra).
3. **`POST /almoxarifado/obras/:obraId/estoque/transferencias`** — Rota deprecada. O método atual de dois-movimentos é substituído pela entidade `alm_transferencias`. A rota antiga retorna `410 Gone` após 90 dias do go-live.
4. **`alm_ordens_compra.obra_id`** — Campo passa de `NOT NULL` para `NULLABLE`. Código que assume NOT NULL em ORM/queries precisa ser revisado.

### Migration strategy

1. **Fase 1 (aditiva — sem downtime):** Criar as novas tabelas sem remover nada. Adicionar as colunas nullable nas tabelas existentes.
2. **Fase 2 (backfill):** Script de migração que cria um registro em `alm_estoque_global` para cada `(tenant_id, catalogo_id)` distinto encontrado em `alm_estoque_saldo`, somando os saldos de todas as obras. Para cada obra, criar um registro em `alm_alocacoes` representando o saldo histórico como "alocado". Popular `alm_cpv` a partir dos movimentos históricos de `tipo = 'saida'` com `preco_unitario` derivado da OC mais recente do item.
3. **Fase 3 (dual-write):** Atualizar o backend para escrever tanto nas tabelas antigas quanto nas novas simultaneamente. Isso garante rollback seguro.
4. **Fase 4 (cutover):** Redirecionar leituras para as novas tabelas. Deprecar rotas antigas com header `Deprecation` e `Sunset`.
5. **Fase 5 (cleanup — 90 dias após cutover):** Remover colunas/tabelas legadas, remover rotas deprecadas.

---

## Consequências

**Positivas:**
- Gestor de tenant tem visão consolidada real de estoque em tempo real.
- Compras centralizadas eliminam OCs duplicadas entre obras.
- CPV por obra é calculado automaticamente, habilitando relatórios de rentabilidade.
- Transferências entre obras são auditáveis e podem exigir aprovação.
- Alertas de reposição podem operar no nível tenant, reduzindo ruptura de estoque.
- Base sólida para funcionalidades futuras: forecast de compras multi-obra, cotações centralizadas, integração com ERP.

**Negativas/Trade-offs:**
- Migration é complexa e tem risco de divergência de dados se o backfill for executado enquanto movimentos ocorrem — requer janela de manutenção ou lock de tabela.
- Lógica de conteúdo cresce: entradas, alocações e consumos são três operações distintas onde antes havia uma.
- Concorrência de alocações exige `SELECT FOR UPDATE` no saldo global — pode ser gargalo em tenants com muitas obras ativas simultâneas.
- Desenvolvedores precisam entender o novo modelo mental: "o material é do tenant; a obra toma emprestado".
- O período de dual-write (Fase 3) dobra a carga de escrita temporariamente.
