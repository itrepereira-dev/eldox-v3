# ADR-002: Efetivo como Recurso do Tenant

**Status:** Proposto
**Data:** 2026-04-17
**Autores:** Orquestrador Eldox

---

## Contexto

### Estado Atual

O módulo de Efetivo (workforce) do Eldox opera inteiramente no escopo de cada obra individualmente. As tabelas relevantes são:

- `empresas_efetivo` — empresas subcontratadas ou próprias, cadastradas por tenant (já tenant-level)
- `funcoes_efetivo` — funções/cargos, cadastrados por tenant (já tenant-level)
- `registros_efetivo` — registros diários de presença (homens·dia), **por obra** (`obraId`, `tenantId`, `data`, `turno`)
- `itens_efetivo` — linhas do registro: empresa + função + quantidade de trabalhadores
- `efetivo_audit_log` — trilha de auditoria por registro (raw SQL, fora do Prisma)

**O problema central:** o modelo atual não registra pessoas nominalmente. Um "registro de efetivo" representa contagens agregadas (ex.: "5 Pedreiros da Empresa X na Obra Y no dia Z"), não trabalhadores identificados. Consequências:

1. **Sem cadastro individual de trabalhadores.** Não há entidade `Pessoa` — apenas a combinação empresa + função + quantidade.
2. **Sem visão consolidada de equipe.** É impossível saber quais trabalhadores o tenant tem disponíveis ou em quais obras estão alocados.
3. **Sem histórico de carreira por pessoa.** Não é possível rastrear em quais obras um determinado trabalhador participou.
4. **Duplicação implícita.** Se uma empresa traz os mesmos 10 pedreiros para obras diferentes, esses trabalhadores não têm identidade no sistema — são apenas entradas numéricas.
5. **Sem controle de equipes nominais.** Não existe conceito de "Equipe de Acabamento — composta por João, Maria, Carlos".
6. **Integração futura bloqueada.** Funcionalidades como ponto eletrônico, EPIs por pessoa, treinamentos e certificações exigem identidade individual.

O controller atual expõe somente rotas sob `/api/v1/obras/:obraId/efetivo`, confirmando o escopo 100% por obra.

---

## Decisão

Migrar o módulo de Efetivo para um modelo de **duas camadas**:

1. **Camada tenant-level:** `Pessoa` (trabalhador individual) e `Equipe` (grupo nominal), ambos com `tenantId` e ciclo de vida independente das obras.
2. **Camada de alocação:** `ObraAlocacao` — vínculo entre uma `Pessoa` e uma `Obra`, com período (data início/fim), função na obra e status (ATIVO / ENCERRADO).

Os `RegistroEfetivo` existentes (contagens homens·dia) são **mantidos** para compatibilidade retroativa e para o RDO, mas passam a conviver com o cadastro nominal. A longo prazo (v4), os registros diários poderão ser gerados automaticamente a partir das alocações ativas, mas isso está fora do escopo desta decisão.

---

## Alternativas Consideradas

### Opção A: Manter por obra (status quo)

**Descrição:** Nenhuma mudança estrutural. Continuar com registros de efetivo como contagens agregadas por obra.

**Prós:**
- Zero esforço de migração
- Nenhuma breaking change
- Sistema simples para cenários de RDO

**Contras:**
- Impossibilita cadastro nominal de trabalhadores
- Sem visão de alocação cruzada entre obras
- Sem histórico individual por pessoa
- Bloqueia funcionalidades de compliance (ASO, NR, treinamentos)
- Sem suporte a equipes nominais
- Impossível construir dashboard de força de trabalho do tenant

**Veredito:** Descartada. O modelo atual já atende o RDO, mas não suporta a evolução necessária do produto.

---

### Opção B: Pessoa tenant-level com Alocacao por obra (ESCOLHIDA)

**Descrição:** Criar entidades `Pessoa` e `Equipe` no nível do tenant. Vincular pessoas a obras via tabela `ObraAlocacao`. Manter `RegistroEfetivo` existente para compatibilidade.

**Prós:**
- Uma pessoa é cadastrada uma vez; aparece em múltiplas obras sem duplicação
- Rastreabilidade completa: quem trabalhou em qual obra, em qual período, com qual função
- Base para compliance (ASO, NR-18, treinamentos, EPIs)
- Permite dashboard de força de trabalho consolidado por tenant
- Equipes nominais: composição de time reutilizável entre obras
- Alocação em bloco: adicionar uma equipe inteira a uma obra em uma operação
- Compatibilidade retroativa: `registros_efetivo` não sofre breaking change
- Fundação para ponto eletrônico nominal no futuro

**Contras:**
- Migração necessária: dados existentes (puramente numéricos) não têm correspondência nominal — a migração criará pessoas "placeholder" se necessário, ou o tenant preenche gradualmente
- Breaking change nas APIs de listagem do efetivo por obra (passa a retornar alocações, não só contagens)
- Aumento de complexidade do módulo
- Curva de aprendizado na UI para o usuário final

**Veredito:** Escolhida. O custo da migração é aceitável e os benefícios são estruturais para o produto.

---

### Opção C: Pessoa tenant-level sem tracking de alocação

**Descrição:** Criar entidade `Pessoa` no nível do tenant, mas sem tabela de alocação. Pessoas são simplesmente referenciadas nos itens do efetivo por obra.

**Prós:**
- Mais simples que a Opção B
- Elimina a duplicação de cadastro

**Contras:**
- Perde rastreabilidade de quem trabalhou em qual obra e em qual período
- Sem data de início/fim de participação na obra
- Sem função específica por obra (uma mesma pessoa pode ser pedreiro em uma obra e encarregado em outra)
- Impossível construir histórico de carreira ou relatórios de alocação
- Não suporta o conceito de "está atualmente alocado"

**Veredito:** Descartada. A rastreabilidade de alocação é um requisito central.

---

## Modelo de Dados (delta)

### Tabelas Novas

| Tabela | Descrição |
|---|---|
| `pessoas` | Trabalhador individual, nível tenant |
| `equipes` | Equipe nominal, nível tenant |
| `pessoas_equipes` | Join table: pessoa pertence a equipe |
| `obra_alocacoes` | Vínculo pessoa-obra com período e função |

### Tabelas Inalteradas (mantidas integralmente)

| Tabela | Motivo |
|---|---|
| `registros_efetivo` | Compatibilidade com RDO; contagens homens·dia permanecem |
| `itens_efetivo` | Idem |
| `empresas_efetivo` | Já é tenant-level; sem alteração |
| `funcoes_efetivo` | Já é tenant-level; sem alteração |
| `efetivo_audit_log` | Raw SQL; mantido |

### Tabelas Depreciadas (sem remoção imediata)

Nenhuma tabela é removida nesta versão. A remoção das tabelas antigas de contagem é planejada para v4, após período de convivência.

---

## Migration Strategy

A migração ocorre em **três fases**:

**Fase 1 — Additive (não-breaking):** Criar as novas tabelas (`pessoas`, `equipes`, `pessoas_equipes`, `obra_alocacoes`) sem alterar nada existente. Sistema continua operando normalmente.

**Fase 2 — Backfill opcional:** Script de migração de dados que oferece ao ADMIN_TENANT a opção de importar trabalhadores via CSV. Os dados existentes em `registros_efetivo` são numéricos (sem nomes), portanto não há backfill automático de pessoas reais. O tenant pode cadastrar o efetivo nominal gradualmente.

**Fase 3 — Deprecation (v4):** Após 6+ meses de adoção, avaliar remoção dos registros numéricos ou mantê-los como "efetivo agregado" paralelo ao efetivo nominal.

---

## Consequencias

### Positivas

- Plataforma suporta gestão completa de força de trabalho nominal
- Base para módulos futuros: ponto eletrônico, EPIs, treinamentos, compliance NR
- Dashboard consolidado de alocações por tenant (quem está onde)
- Histórico de carreira por trabalhador (obras participadas, funções exercidas)
- Equipes reutilizáveis entre obras sem recadastro
- Relatórios de turnover e disponibilidade de mão de obra

### Negativas / Trade-offs

- APIs de listagem de efetivo por obra mudam de resposta (nova estrutura `ObraAlocacao`)
- Frontend da tela `/obras/:id/efetivo` precisa ser refatorado para exibir alocações
- Necessidade de novas telas: "Cadastro de Pessoas" e "Equipes" em nível tenant
- Tenants existentes iniciam com efetivo nominal vazio — dados históricos de contagem não se convertem automaticamente em pessoas nominais
- ADMIN_TENANT precisa ser orientado a cadastrar o efetivo nominal gradualmente ou via importação CSV
