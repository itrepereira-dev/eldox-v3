# Camada 12 — Compliance do Domínio (Construção Civil) + LGPD

**Auditor:** auditor-camada-12-compliance
**Data:** 2026-04-17
**Escopo:** PBQP-H SiAC, ISO 9001:2015 (cls. 7.5 / 8.5 / 9.1), NBR 12655 (concreto),
NBR 12284 / Diário de Obra, NR-06 / NR-18 (efetivo), LGPD.
**Mobile:** N/A — `frontend-mobile/` não existe no repositório.

---

## 1. Resumo executivo

O Eldox v3 tem **base forte** em compliance onde investiu: GED com audit-log
imutável (trigger PG), FVS com ciclo NC completo (causa raiz, ações, SLA,
tratamentos por ciclo), Concretagem com RAC (ISO 9001 cls. 10.2), RDO com
versionamento de edições append-only e bloqueio pós-aprovação.

Há **lacunas críticas** em três eixos que bloqueiam certificação:

1. **Rastreabilidade de concreto (NBR 12655):** traço salvo como `VARCHAR(100)`
   — não é possível auditar composição, a/c por traço, aditivos;
   cura **não é registrada** em lugar algum; croqui não vincula elementos a CPs.
2. **Efetivo como contagem, não como pessoas:** schema `registros_efetivo` +
   `itens_efetivo` armazena **apenas quantidade por função/empresa** — sem CPF,
   CBO, nome, hora entrada/saída individual, ASO, EPI. Descumpre NR-18,
   Portaria MTE 671/2021 (ponto) e inviabiliza certificação SST.
3. **LGPD ausente:** zero infraestrutura (sem termo, sem consentimento, sem
   DPO, sem export de dados, sem anonimização). Dados pessoais circulam
   (`Usuario.email`, `Usuario.telefone`, `EmpresaEfetivo.cnpj`, destinatários
   externos em `ged_transmittal_destinatarios`) sem base legal registrada.

Total de achados: **23** (6 🔴 · 10 🟠 · 5 🟡 · 2 🔵).

---

## 2. Achados por severidade

### 🔴 CRÍTICOS — bloqueiam certificação/compliance

#### C12-001 🔴  Rastreabilidade de traço de concreto não estruturada
- **Evidência:** `backend/prisma/migrations/20260415000002_sprint8_concretagem/migration.sql:41`
  — `traco_especificado VARCHAR(100)` é um único campo de texto livre;
  `fck_especificado INTEGER` é o único dado numérico da composição.
- **Norma:** NBR 12655:2015 §5.4.2.1 exige rastreabilidade de composição por
  classe de concreto.
- **Sintoma:** Dado um CP reprovado, o sistema não consegue responder
  "qual a relação a/c real? qual o consumo de cimento? havia aditivo?" —
  só é possível consultar `fator_ac` (no caminhão, `20260416000002_concretagem_consultegeo_gaps/migration.sql:55`),
  mas não a composição completa do traço.
- **Causa:** Schema foi desenhado como "resumo operacional", não como
  registro tecnológico.
- **Impacto:** Auditor PBQP-H pede evidência de controle de traço — o
  sistema não entrega.

#### C12-002 🔴  Cura do concreto não é registrada
- **Evidência:** `Grep cura` em `backend/prisma/migrations/` → 0 ocorrências;
  `Grep cura` em `backend/src/concretagem/` → 0 ocorrências.
- **Norma:** NBR 14931:2004 §10.5 + NBR 12655 exigem registro de cura
  (duração, método: molhagem, cura química, cobertura).
- **Sintoma:** Tabela `betonadas` (campo `status` termina em `CONCLUIDA`) e
  `caminhoes_concreto` encerram no lançamento; não há tabela
  `concretagem_cura` ou colunas `cura_inicio/cura_fim/metodo_cura`.
- **Impacto:** Patologia estrutural por cura insuficiente fica sem defesa
  documental.

#### C12-003 🔴  Vínculo CP ↔ elemento estrutural do croqui é indireto
- **Evidência:** `backend/prisma/schema.prisma:531` (ConcretagemCroqui) e
  `backend/prisma/migrations/20260415000002_sprint8_concretagem/migration.sql:102`
  (corpos_de_prova) — a FK de CP é apenas
  `betonada_id` + `caminhao_id`. O campo `elemento_lancado VARCHAR(200)` do
  caminhão (e `elementos_lancados TEXT[]` em `20260416000020`) é texto
  livre; não há FK para um elemento identificado no croqui.
- **Teste-chave da skill:** "dado um CP reprovado, em 1 clique listar
  exatamente qual volume de concreto foi aplicado, onde e quando"
  — só é possível por aproximação textual, não por chave relacional.
- **Impacto:** Rastreabilidade reversa para demolição seletiva é manual.

#### C12-004 🔴  Efetivo não identifica trabalhadores individualmente
- **Evidência:** `backend/prisma/migrations/20260415000010_efetivo_module/migration.sql:64-73`
  — tabela `itens_efetivo` tem apenas
  `empresa_id, funcao_id, quantidade, observacao`. Nenhuma coluna para
  nome, CPF, CBO, ASO, entrada/saída individual.
- **Norma/Lei:** NR-18 (PCMAT — lista nominal);
  Portaria MTE 671/2021 (registro de ponto); art. 41 CLT (livro de registro).
- **Sintoma:** Sistema reporta "15 pedreiros subcontratada A", mas não
  reporta quem são nem se têm ASO válido / EPI entregue.
- **Impacto:** Fiscal do MTE pede lista nominal → o sistema não tem.

#### C12-005 🔴  Zero infraestrutura LGPD
- **Evidência:**
  - `Grep termo_uso|consentimento|politica_privacidade|opt_in` no backend → 0
    resultados.
  - `Grep dpo|lgpd|privacidade|anonimiza` em migrations → 0 resultados.
  - `Usuario.deletedAt` em `schema.prisma:65` é **soft delete sem
    anonimização** (nome, email permanecem).
  - Portabilidade (export completo LGPD §18 V) → não existe.
  - `EmpresaEfetivo.cnpj` (`schema.prisma:798`), `Usuario.email`,
    `Usuario.telefone` (`20260414000006_usuario_telefone/migration.sql:2`)
    armazenados sem base legal registrada.
- **Norma:** LGPD Lei 13.709/2018 arts. 7º, 8º, 18, 41, 48.
- **Impacto:** Multa até 2% do faturamento (limitada a R$ 50M/ocorrência).
  Bloqueador para clientes enterprise / órgão público.

#### C12-006 🔴  Diário (RDO) não usa assinatura digital verificável
- **Evidência:** `backend/prisma/migrations/20260414000001_rdo_module/migration.sql`
  tabela `rdo_assinaturas` (implícita; modelo Prisma em `schema.prisma:492`)
  armazena `assinaturaBase64 String @db.Text` — é **apenas a imagem
  desenhada na tela**. Nenhum hash do payload, nenhum timestamp confiável
  (só `assinadoEm` TIMESTAMP), sem 2FA / PIN, sem cadeia de custódia.
- **Valor jurídico:** imagem base64 não tem força probatória se contestada
  (MP 2.200-2/2001 + Lei 14.063/2020 art. 4º — "assinatura eletrônica
  avançada" exige vínculo inequívoco).
- **Impacto:** Diário de Obra perde validade em perícia.

---

### 🟠 ALTO — gaps sérios de compliance mas contornáveis

#### C12-007 🟠  NC global sem ciclo CAPA completo
- **Evidência:** `backend/prisma/migrations/20260415000003_nao_conformidades/migration.sql:11-35`
  — tabela `nao_conformidades` (modelo unificado cross-módulo) tem
  `descricao, status, responsavel_id, prazo, data_fechamento`
  mas **não tem** `causa_raiz`, `acao_corretiva`, `acao_preventiva`,
  `eficacia_verificada`, `eficacia_verificada_em`, `eficacia_verificada_por`.
- **Inconsistência:** FVS tem esses campos em `fvs_nao_conformidades`
  (`20260413100000_fvs_sprint4b_nc_ciclo/migration.sql:27-33`);
  Concretagem tem em `racs` (`20260416000002_concretagem_consultegeo_gaps/migration.sql:122-131`).
  Mas o modelo central (`NaoConformidade` em `schema.prisma:597-632`), usado
  pelo sidebar `/ncs`, NÃO tem.
- **Norma:** ISO 9001:2015 §10.2; PBQP-H SiAC 5.2.
- **Impacto:** NCs de outros módulos (Ensaio, FVM, Concretagem indireto,
  Geral) não têm registro de análise de causa raiz nem verificação de
  eficácia — ciclo PDCA inviável.

#### C12-008 🟠  Planos de Ação (CAPA) restritos a FVS
- **Evidência:** `backend/prisma/migrations/20260416200000_add_planos_acao/migration.sql:86`
  — `CHECK (origem_tipo IN ('INSPECAO_FVS','NC_FVS','MANUAL'))` e default
  `modulo='FVS'` em `pa_plano_acao` linha 67, `pa_config_ciclo` linha 8.
- **Impacto:** NC de ensaio laboratorial ou de lote FVM não dispara plano
  de ação formal. ISO 9001 exige ciclo aplicável a **todas** as NCs.
- **Cross-ref [Camada 2 – Módulos órfãos]:** módulo PA foi construído como
  peça do FVS Sprint 4b e não foi generalizado.

#### C12-009 🟠  Documento de obra sem metadados PBQP-H obrigatórios
- **Evidência:** `backend/prisma/migrations/20260407000000_ged_module/migration.sql:176-200`
  (`ged_documentos`) — falta `responsavel_tecnico_id` (RT da ART), falta
  `numero_art`/`numero_rrt`, falta `data_vigencia_rt`. Campo `ARTs/RRTs`
  existe apenas como **categoria** (linha 159) — não como campo estrutural
  do documento.
- **Norma:** PBQP-H SiAC §7 + NBR 12284 exigem vínculo ART/profissional
  responsável em todo documento de projeto.
- **Impacto:** Auditor pergunta "quem é o RT desse laudo/projeto?" —
  resposta está no PDF, não no sistema.

#### C12-010 🟠  Mão de obra no RDO é livre, sem CPF/CBO
- **Evidência:** `backend/prisma/migrations/20260414000001_rdo_module/migration.sql:108-125`
  `rdo_mao_de_obra` tem só `funcao VARCHAR(150), quantidade INT,
  nome_personalizado VARCHAR(150)`.
- **Redundância com C12-004.** RDO herda o mesmo vício do módulo Efetivo
  — diário reporta "2 pedreiros" sem saber quem.
- **Norma:** Diário de Obra (NBR 12284 §5.5) pede efetivo **nominal**
  quando aplicável.

#### C12-011 🟠  Sobrepõem-se NCs de origens diferentes (fvs, fvm, global)
- **Evidência:** existem três tabelas de NC distintas —
  `fvs_nao_conformidades` (`20260413100000…`),
  `fvm_nao_conformidades` (`20260414000000_fvm_module/migration.sql:222-253`),
  e `nao_conformidades` global (`20260415000003…`).
- **Impacto:** Dashboard unificado de NCs (tela `/ncs`) só lê a tabela
  global — as NCs de FVS e FVM aparecem no dashboard como "referência"
  (campo `fvs_ficha_id`, `fvm_lote_id`) mas o ciclo real mora nas tabelas
  específicas, o que dificulta relatório consolidado de qualidade.

#### C12-012 🟠  Assinatura e imutabilidade de versões GED dependem de app, não do banco
- **Evidência:** `backend/prisma/migrations/20260407000000_ged_module/migration.sql:228-286`
  (`ged_versoes`) — existe `checksum_sha256`, `aprovado_por`, `aprovado_em`.
  **Mas** não há trigger impedindo `UPDATE storage_key` ou
  `UPDATE checksum_sha256` após `status IN ('IFC','IFP','AS_BUILT')`. Apenas
  `ged_audit_log` tem trigger de imutabilidade (linha 401-411) — os
  metadados da versão em si ficam editáveis.
- **Impacto:** Se app for bypassado (SUPERUSER, script admin), uma versão
  "vigente" pode ser re-apontada a outro arquivo sem rastro no
  `ged_audit_log` (só o app grava lá).

#### C12-013 🟠  Assinatura digital inexistente em documentos aprovados
- **Evidência:** `ged_versoes` (`20260407000000_ged_module/migration.sql:228-286`)
  armazena PDF + hash, mas não há PKCS#7/CMS signature embutida nem
  carimbo do tempo ICP-Brasil. Campos `aprovado_por + aprovado_em + hash`
  compõem evidência, não assinatura qualificada.
- **Norma/Lei:** MP 2.200-2/2001 + Lei 14.063/2020 — documentos oficiais
  precisam de assinatura eletrônica **avançada** (vínculo inequívoco ao
  signatário) para garantir não-repúdio.
- **Impacto:** Para PBQP-H nível A / ISO 9001 aceita; para órgão público
  / PF / PJ externa — rejeitado.

#### C12-014 🟠  Retenção de documentos não é programática
- **Evidência:** `ged_categorias.prazo_revisao_dias`
  (`20260407000000_ged_module/migration.sql:146`) define apenas prazo para
  revisão. Não há `prazo_retencao_anos` automático por categoria, nem job
  que arquive/expurge documentos conforme política.
- **Norma:** Documentos fiscais 5 anos (RIR/99), trabalhistas 5 anos, ART
  conforme art. 25 Lei 5.194/66.
- **Impacto:** Tenant paga storage indefinido; políticas de descarte
  dependem de ação manual.

#### C12-015 🟠  Modelo central `Usuario` sem anonimização no soft-delete
- **Evidência:** `backend/prisma/schema.prisma:55-75` —
  `deletedAt DateTime?` mas `nome`, `email`, `senhaHash` e `telefone`
  permanecem. LGPD art. 18 VI exige
  "eliminação dos dados pessoais tratados com o consentimento do titular".
- **Impacto:** Titular solicita exclusão → sistema marca deleted mas
  retém PII. Não conforme LGPD.

#### C12-016 🟠  Destinatários externos de Transmittal sem base legal
- **Evidência:** `ged_transmittal_destinatarios`
  (`20260407000000_ged_module/migration.sql:349-367`) coleta
  `email_externo VARCHAR(255), whatsapp VARCHAR(20)` sem registro de
  consentimento ou de finalidade.
- **LGPD:** art. 7º + art. 8º (consentimento livre, informado, inequívoco).
- **Impacto:** Cada destinatário externo é um potencial titular que pode
  pleitear exclusão sem trilha legal.

---

### 🟡 MÉDIO — polimento para maturidade

#### C12-017 🟡  Clima do RDO sem campos pluviométricos / umidade padrão
- **Evidência:** `backend/prisma/migrations/20260414000001_rdo_module/migration.sql:84-101`
  — `rdo_clima` tem `condicao ENUM(claro/nublado/chuvoso), chuva_mm DECIMAL(4,1)`.
  Falta umidade relativa, velocidade de vento (relevante para concretagem
  e impermeabilização — NBR 14931 §7.3).
- **Impacto:** Justificativa de paralisação por clima pode ser contestada.

#### C12-018 🟡  Sem `fck_obra_aceite` vs `fck_especificado` (critério NBR 12655)
- **Evidência:** `betonadas.fck_especificado INTEGER` em
  `20260415000002_sprint8_concretagem/migration.sql:42`. Não há
  coluna/flag que compute aceitação estatística (amostras `A` ou `B`,
  `fck,est ≥ fck,proj` com confiança) automaticamente.
- **Impacto:** Aceitação final do concreto continua manual.

#### C12-019 🟡  Tabela `fvs_audit_log` é append-only por convenção, não por trigger
- **Evidência:** `backend/prisma/migrations/20260408000001_fvs_inspecao/migration.sql:78-92`
  tabela existe, mas **não** tem trigger equivalente ao
  `ged_audit_log_immutable` (GED linha 401-411). Só o GED tem proteção a
  UPDATE/DELETE no banco.
- **Impacto:** Inconsistência de padrão — rastro de FVS e de efetivo
  (`efetivo_audit_log` em `20260415000010_efetivo_module/migration.sql:78-87`)
  dependem só de disciplina de código.

#### C12-020 🟡  Sem tabela de indicadores da qualidade PBQP-H
- **Evidência:** `SemaforoPbqphCache` (`schema.prisma:554-568`) é cache
  computado, não histórico de indicadores (retrabalho, índice de NC,
  satisfação). Não há `qualidade_indicadores` / `analise_critica_direcao`.
- **Norma:** PBQP-H SiAC §8 / ISO 9001 §9.1.3 + §9.3.
- **Impacto:** Análise crítica pela direção (reunião formal trimestral)
  precisa ser montada manualmente.

#### C12-021 🟡  Laboratórios: CNPJ sem validação e sem acreditação INMETRO
- **Evidência:** `backend/prisma/migrations/20260414000004_ensaio_laboratorial/migration.sql:4-13`
  — `laboratorios` tem `cnpj VARCHAR(18)` mas nenhum
  `acreditacao_numero`, `acreditado_inmetro BOOLEAN`, nem validação de
  dígito verificador CNPJ (é só `VARCHAR`).
- **Norma:** NBR ISO/IEC 17025 — laboratório de ensaio deve ser
  acreditado.
- **Impacto:** Laudo de laboratório não acreditado pode ser rejeitado em
  auditoria.

---

### 🔵 INFO — observações / boas práticas identificadas

#### C12-022 🔵  Forças destacadas (manter)
- `ged_audit_log` com trigger de imutabilidade — único no sistema.
  `20260407000000_ged_module/migration.sql:401-411`.
- `ged_versoes.checksum_sha256 VARCHAR(64) NOT NULL` +
  `ged_versoes.status_emissao GENERATED ALWAYS AS` — bom design.
  Linhas 246-260 mesma migration.
- `RdoLogEdicao` (schema.prisma:635-654) é append-only por design
  (sem `updatedAt`, sem `deletedAt`).
- `ObraQualityConfig` (schema.prisma:262-272) tem `slaAprovacaoHoras`,
  `exigeAssinaturaFVS`, `exigeAssinaturaDiario` — boa parametrização PBQP-H.
- `fvs_modelos.regime` com CHECK `(livre|pbqph)`
  (`20260410000000_fvs_sprint4a_modelos/migration.sql:27`) — seletor
  correto de modo de auditoria.

#### C12-023 🔵  Sprint 4 de FVS (MEMORY.md) já projeta templates de sistema
- Decisão documentada em `~/.claude/projects/…/project_fvs_sprint4_templates.md`
  (ativar 3 templates de sistema com flags `exige_ro/exige_reinsspecao/exige_parecer`)
  caminha para PBQP-H — convergente com este relatório.

---

## 3. Checklist da skill — síntese

| Seção skill | Status | Notas |
|------------|--------|-------|
| 12.1 PBQP-H — Documentos (SGQ, POP, IT, FVS/FVM/FVR) | 🟡 parcial | GED + FVS cobrem; faltam vínculo RT (C12-009), retenção (C12-014), indicadores (C12-020) |
| 12.1 PBQP-H — SECs | ✅ ok | `fvs_catalogo_servicos` + `ObraQualityConfig.modoQualidade=PBQPH` |
| 12.1 PBQP-H — MACs | ✅ ok | `fvm_*` completo, 13 tabelas, quarentena, homologação |
| 12.1 PBQP-H — Indicadores | 🟠 gap | C12-020 — só cache semáforo, sem histórico / análise crítica |
| 12.2 ISO 9001:2015 | 🟠 gap | RAC existe; causa raiz global não (C12-007); análise crítica não (C12-020) |
| 12.3 NBR 12655 — traço | 🔴 gap | C12-001 |
| 12.3 NBR 12655 — caminhão/hora/slump/temp | ✅ ok | `caminhoes_concreto` tem tudo |
| 12.3 NBR 12655 — CP rompimento | ✅ ok | `corpos_de_prova` + `ensaio_laboratorial` |
| 12.3 NBR 12655 — cura | 🔴 gap | C12-002 |
| 12.3 NBR 12655 — vínculo CP ↔ local | 🔴 gap | C12-003 |
| 12.4 Diário de Obras | 🟠 gap | Campos OK; assinatura imagem-base64 sem peso jurídico (C12-006); efetivo não nominal (C12-010) |
| 12.5 Efetivo / NR-06/18 / MTE | 🔴 gap | C12-004 |
| 12.6 GED — versionamento, imutabilidade, obsolescência, aprovação | ✅ ok | Parcialmente (C12-012 + C12-014) |
| 12.7 Assinatura digital | 🔴 gap | C12-006 / C12-013 |
| 12.8 LGPD | 🔴 gap | C12-005 + C12-015 + C12-016 |
| 12.9 Retenção legal | 🟠 gap | C12-014 |
| 12.10 Relatório "pronto para auditoria" / export | 🟠 gap | não há endpoint de dossiê consolidado nem export LGPD |

---

## 4. Cross-refs (tocam outras camadas)

- **[Camada 2 — Módulos órfãos]** Módulos `planos-acao/` amarrados a FVS
  (C12-008). Três tabelas de NC paralelas (C12-011) — decisão arquitetural
  pendente.
- **[Camada 3 — API / Back]** Global `NaoConformidade` em `schema.prisma:597`
  precisa ser estendida com causa_raiz/ação corretiva/eficácia (C12-007).
- **[Camada 7 — Segurança & RLS]** SUPERUSER Prisma bypassa RLS e pode
  alterar `ged_versoes` sem trigger (C12-012).
- **[Camada 8 — Dados pessoais / LGPD]** C12-005, C12-015, C12-016 —
  requerem tabela `consentimentos`, job de anonimização, endpoint
  `/api/v1/lgpd/export` e `/api/v1/lgpd/esquecimento`.
- **[Camada 11 — Auditoria / Log]** Só `ged_audit_log` tem trigger de
  imutabilidade (C12-019). `fvs_audit_log`, `efetivo_audit_log`,
  `rdo_log_edicoes` são append-only por convenção.

---

## 5. Resumo para orquestrador

**Totais:** 23 achados — 🔴 6 · 🟠 10 · 🟡 5 · 🔵 2 (positivos).

**Top 3 ações urgentes (ordem de implementação):**

1. **(C12-005 + C12-015 + C12-016) Camada LGPD mínima.** Criar tabela
   `consentimentos (tenant_id, usuario_id, tipo, versao_politica, aceito_em, ip, user_agent)`,
   `politicas_privacidade (versao, corpo, publicada_em)`, endpoint
   `GET /api/v1/lgpd/export/:usuarioId` e worker de anonimização no
   soft-delete do `Usuario` (trocar `nome` por `"[excluído]"`, hash do
   email). Registrar DPO nas configurações do tenant. Sem isso, o produto
   não pode ser vendido a órgão público.
2. **(C12-004 + C12-010) Tabela `efetivo_trabalhadores` nominal.** Criar
   `trabalhadores (id, tenant_id, empresa_id, nome, cpf_hash, cbo, aso_validade, epi_entrega_data, …)`
   e migrar `itens_efetivo.quantidade` para lista de `trabalhador_id`.
   Integrar com `rdo_mao_de_obra`. Sem isso, fiscal MTE trava
   compliance SST.
3. **(C12-001 + C12-002 + C12-003) Estrutura NBR 12655.** Criar tabelas
   `tracos_concreto` (composição estruturada), `concretagem_cura`
   (método, início, fim, observador) e FK
   `corpo_prova.croqui_elemento_id`. Sem isso, rastreabilidade tecnológica
   é pro forma.

**Esforço estimado global:** 3 sprints (LGPD: 2 semanas; Efetivo nominal: 2
semanas + UX; NBR 12655 estrutural: 3 semanas + migração de dados).

**Risco de regressão:** médio-baixo — todas as mudanças são aditivas
(novas tabelas + migração idempotente). Única mudança destrutiva é o
padrão de soft-delete do `Usuario` (C12-015), que precisa de feature flag.

**Cross-refs:** Camada 2 (módulos órfãos de PA e NC), Camada 7 (RLS e
SUPERUSER), Camada 8 (LGPD), Camada 11 (triggers append-only).
