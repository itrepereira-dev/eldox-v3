# Diário de Obra — Análise Competitiva (UpdateDigital vs. Eldox v3)

**Data da análise:** 2026-04-17
**Autor:** Agente de análise (Claude)
**Fontes:** 2 vídeos do YouTube do canal "App Diário de Obra" — apresentação + treinamento do app concorrente da **Update Digital** (domínio `web.diariodeobra.app`, produto `UPDATE DIGITAL`). Os vídeos mostram o app mobile (iOS) e o portal web funcionando lado a lado, o que permitiu mapear a arquitetura completa do sistema.

---

## 1. Resumo executivo

O concorrente **Update Digital / Diário de Obra** é um SaaS multi-tenant dedicado exclusivamente a **Relatório Diário de Obra (RDO) + cadastros globais + catálogo de obras**. Não possui módulos de qualidade (FVS/FVM), concretagem, ensaios ou NCs. O foco é: registrar rotina diária, gerar PDF com logomarca do cliente, compartilhar e acompanhar progresso via lista de tarefas (WBS) com percentuais. O produto tem **3 planos** (o tenant demo está em "Plano 3" com obras e usuários ilimitados) e **papéis por obra** (Administrador, Personalizado, Cliente obra).

A arquitetura mostrada nos vídeos é clássica:

- **Web** (`web.diariodeobra.app`) — painel completo com sidebar por obra (Visão geral, Lista de tarefas, Relatórios, Pesquisa avançada, Configurações).
- **Mobile** (iOS — a arte sugere React Native ou Ionic) — espelho do web com foco em coleta de campo (clima, mão de obra, equipamentos, atividades, ocorrências, fotos, comentários, anexos).
- **Cadastros globais** (Mão de obra padrão + personalizada, Equipamentos, Tipos de ocorrências, Usuários, Empresa) reutilizados por todas as obras.
- **RDO como formulário único** com seções colapsáveis ("Copiar informações do último relatório" com toggles por seção — clima, mão de obra, equipamentos, atividades, comentários).
- **PDF branded** com logomarca da empresa + logomarca do cliente lado a lado (ex: "UPDATE Construções" + "Prefeitura Santa Luzia") e campos do relatório customizáveis (ativar/desativar seções por obra).

Comparado ao **Eldox v3**, o concorrente é **mais simples, mais limpo e mais maduro no fluxo de RDO clássico**, mas **o Eldox é drasticamente mais completo** (FVS Sprint 4, Concretagem, Ensaios, Semáforo PBQP-H, IA com sugestões de clima/mão-de-obra, workflow de aprovações, pipeline multi-agente). O que falta ao Eldox são **quick-wins de UX e produto**: cadastro global de equipamentos/tipos-de-ocorrência, lista de tarefas (WBS) por obra com % executado, personalização do layout do PDF por obra, galeria de fotos consolidada com filtros por data/atividade, documentos da obra com pastas, e o botão "Copiar último relatório" com **toggles por seção** (hoje o Eldox copia ou não copia, sem granularidade).

Estimativa de esforço total para fechar os gaps prioritários (quick-wins + P1): **~55 pessoas/dia (3 sprints de 5 dias com 2 devs + 1 agente IA assistente)**.

---

## 2. Inventário de telas analisadas

**Total de frames distintos analisados: 24** (vídeo 1: 11 / vídeo 2: 13). Frames "título de capítulo" foram ignorados.

### Vídeo 1 — Apresentação completa (foco mobile)

| Timestamp | Nome da tela | Módulo | Elementos-chave | Frame |
|---|---|---|---|---|
| 00:00 | Splash / capa vídeo | — | Logo "Diário de Obra" — branding do canal | `video1/frames-small/frame_0000_0.50s.png` |
| 00:02 | Login mobile | Auth | E-mail, Senha, Entrar, "Esqueceu a sua senha?", "Cadastrar minha conta de teste" (self-signup teste) | `video1/frames-small/frame_0001_2.50s.png` |
| 05:47 | Lista de Usuários | Cadastro → Usuários | Agrupado por papel: Administrador (4), Personalizado (1), Cliente obra (1). Cada linha com avatar + nome + email + status "Ativo". Botão "+" header para novo. | `video1/frames-small/frame_0008_347.53s.png` |
| 11:37 | Adicionar mão de obra | RDO mobile → Mão de obra | Campos: Nome, Função, Entrada (09:00), Saída (17:00), Hs Intervalo (01:00), Horas trabalhadas (07:00). Modal "Selecione o grupo": Mão de Obra Direta, Mão de Obra Indireta, Terceiros. | `video1/frames-small/frame_0013_697.47s.png` |
| 14:23 | Lista de Obras | Home / Obras | Lista com foto + nome + status (Em Andamento / Finalizada / Não Iniciada / Concluída) + contadores (ícones de relatórios/atividades). Tab bar inferior: Obras, Relatórios, [+], Cadastros, Perfil. Counter no header "Obras (8)". | `video1/frames-small/frame_0015_739.53s.png` |
| 14:33 | Busca de obra | Obras | Top-search com filtros: "todas as obras", "todos os planos", modal "Selecione o grupo" (Todas, Prefeitura, Terceirizados). | `video1/frames-small/frame_0020_884.83s.png` |
| 16:17 | Editar obra → Galeria de fotos | Obras → foto capa | Picker iOS nativo com aba Fotos / Álbuns e grid de 3 colunas. | `video1/frames-small/frame_0029_977.17s.png` |
| 28:22 | Adicionar relatório (RDO) | RDO mobile | Campos: Selecione a obra, Modelo de relatório ("Relatório Diário de Obra (RDO)"), Data (picker wheel iOS), toggle "Salvar relatório off-line", toggle "Copiar informações do último relatório". Banner: "Último relatório cadastrado: 18/10/2022 nº 36". | `video1/frames-small/frame_0052_1716.67s.png` |
| 30:22 | Adicionar atividade — status | RDO → Atividades | Descrição textarea, modal "Selecione o status": Nenhum item / Iniciada / Em Andamento / Concluída / Não Iniciada / Paralisada / Não Executada. Campo "Porcentagem %". | `video1/frames-small/frame_0054_1822.43s.png` |
| 32:21 | Galeria nativa iOS (selecionar fotos) | RDO → Fotos | Tela do iOS PhotoPicker, múltiplas fotos (até 30) com contador em cada thumb. | `video1/frames-small/frame_0058_1961.63s.png` |
| 32:35 | Galeria — upload no RDO | RDO → Fotos | Header "Editar relatório" + "Selecione até 30 fotos" + grid com checkmarks azuis + botão "Adicionar". | `video1/frames-small/frame_0057_1941.30s.png` |

### Vídeo 2 — Treinamento completo (web + mobile lado a lado)

| Timestamp | Nome da tela | Módulo | Elementos-chave | Frame |
|---|---|---|---|---|
| 02:04 | PDF gerado + Cadastro empresa | Exportação / Config empresa | PDF "Relatório Diário de Obra" com header (logo UPDATE, obra, cliente, nº relatório, datas), Efetivo de obra (tabela funções x quantidades), Atividades/tarefas, Equipamentos, Ocorrências, Materiais, Comentários, Galeria de fotos. Lado direito: tela mobile "Empresa" (logomarca, razão social, CNPJ, telefone). | `video2/frames-small/frame_0001_124.87s.png` |
| 02:52 | Empresa — Web | Config → Empresa | Cards "Informações da empresa" (logo, nome, razão social, CNPJ, telefone) + "Plano ativo" (Plano 3, Limite obras: ilimitado, Limite usuários: ilimitado, Período Mensal, Data do cadastro, Contratado por Tiago Oliveira). | `video2/frames-small/frame_0003_172.20s.png` |
| 07:31 | Cadastro global — Mão de obra | Config → Mão de obra | Tabs: **Categoria (3)** (Direta / Indireta / Terceiros), **Padrão (10)**, **Personalizada (4)**. Cada linha: Nome, Função, Horário (08:00-17:00), Categoria. | `video2/frames-small/frame_0007_529.03s.png` |
| 11:19 | Confirmação de exclusão | Cadastro → Mão de obra | Modal "Excluir mão de obra? Esta ação não pode ser desfeita. [Sim, excluir] [Cancelar]". | `video2/frames-small/frame_0009_609.20s.png` |
| 11:28 | Cadastro global — Equipamentos | Config → Equipamentos | Lista de 19 equipamentos (Andaime, Betoneira, Bomba de Lançamento, Caminhão Basculante/Betoneira, Carrinho de Mão, Compactador, Containers, Empilhadeira, Escavadeira, Furadeira, Guindaste, Marteleteira, Martelo, Policorte, Pá Carregadeira, Retroescavadeira, Trator). | `video2/frames-small/frame_0012_688.30s.png` |
| 13:43 | Cadastro global — Tipos de ocorrências | Config → Ocorrências | 15 tipos: Acidente com ferimentos leves / com perfuração / de trabalho, Alagamentos, Conclusão de etapa, Dia parado, Falta de Material, Falta de mão de obra, Greve, Solicitação fora do escopo / de mudança / do cliente, Tempestade, Visita do Fiscal, Visita para Inspeção. | `video2/frames-small/frame_0016_823.63s.png` |
| 14:18 | Editar/Excluir ocorrência (modal) | Cadastro → Ocorrências | ActionSheet mobile: Editar / Excluir / Cancelar. Toast verde "Alterado com sucesso". | `video2/frames-small/frame_0018_858.70s.png` |
| 15:18 | Adicionar obra | Obras | Sidebar da obra: **Acompanhamento da obra** (Visão geral, Relatórios, Pesquisa avançada) + **Editar dados da obra** (Configurações → Informações da obra, Personalizar relatório, Usuários, Documentos). Painel direito mobile: campos Nome, Cliente da obra (Prefeitura), Data início, Previsão de término, Endereço, Código do contrato, Status (Em Andamento). | `video2/frames-small/frame_0020_918.77s.png` |
| 18:18 | Galeria de fotos (pesquisa avançada) | Obra → Pesquisa avançada | Menu esquerdo: **Pesquisa avançada** (Galeria de fotos, Atividades, Ocorrências, Comentários, Anexos, Clima/Tempo, Histórico mão de obra, Histórico equipamentos). Grid com fotos agrupadas por data (29/05/2018, 22/05/2018, 15/05/2018, 20/04/2018). Filtros: "Últimos 12 meses", "Ordem decrescente". | `video2/frames-small/frame_0025_1098.83s.png` |
| 24:09 | Personalizar relatório | Obra → Configurações | Cards: "Logomarca do cliente" (Logomarca da empresa + Logomarca do cliente com botões Adicionar/Excluir), "Título do relatório" (Nome do relatório configurável), **"Ativar/Desativar itens do relatório"** (Horário de trabalho, Clima/Tempo, Mão de obra, Equipamento, Atividade, Ocorrência, Controle de material — cada um com toggle Ativar/Desativar). | `video2/frames-small/frame_0029_1465.43s.png` |
| 26:57 | Documentos da obra | Obra → Documentos | Pastas colapsáveis: **Financeiro (2)** (IMG_7387, IMG_7388 com botão download), **Plantas (3)** (IMG_7362, 7363, 7364). Estrutura em árvore com ícone de pasta. | `video2/frames-small/frame_0033_1675.60s.png` |
| 28:15 | Lista de tarefas (WBS) | Obra → Lista de tarefas | Grid de 4 KPI cards (Total, Em Andamento, Não Iniciada, Concluída) + tabela com numeração hierárquica: 1.0 Administração local → 1.1 Engenheiro civil de obra júnior, 1.2 Mestre de obras / 2.0 Serviços preliminares / 3.0 Fundação — rasos, com % por linha. Painel direito mobile: "Adicionar etapa" (Item 1.0, Descrição "Serviços preliminares"). | `video2/frames-small/frame_0035_1755.03s.png` |
| 31:32 | Importar lista de tarefas | Obra → Lista de tarefas | Modal "Importar lista de tarefas" com tabela pré-preenchida (árvore hierárquica) + botão "Selecionar todos" + toast "90% enviando..." durante upload. | `video2/frames-small/frame_0037_1892.20s.png` |
| 33:31 | Adicionar relatório (web) | Obra → Relatórios | Form "Editar relatório": Obra, Data, toggle "Salvar relatório OFFLINE", toggle "Copiar informações do último relatório" **expandido com sub-toggles: Clima / Mão de obra / Equipamentos / Atividades / Comentários** (granular!). | `video2/frames-small/frame_0040_2011.30s.png` |
| 36:12 | RDO — Equipamentos | Relatório | Tabela de equipamentos com colunas quantidade (numeric stepper) + botão X. Mobile picker "Selecione os equipamentos" com radio de todo catálogo. | `video2/frames-small/frame_0042_2180.63s.png` |
| 37:52 | RDO — Atividade (edit inline) | Relatório | Lista de atividades com status % inline (70% Em Andamento, 10%, Não iniciada) e link para editar. Cards: Ocorrências/Observações, Materiais recebidos, Materiais utilizados, Comentários, Galeria de fotos, Anexos, Status do relatório (Preenchimento Iniciado). | `video2/frames-small/frame_0044_2272.30s.png` |
| 38:57 | RDO — Ocorrência | Relatório | Painel direito mobile: "Adicionar ocorrência" — Descrição textarea + "Tipo de ocorrência (tag)" radio com todo catálogo global. | `video2/frames-small/frame_0048_2472.60s.png` |
| 41:12 | RDO — Materiais | Relatório | Cards "Materiais recebidos (1)" (Cimento 10 sacos) + "Materiais utilizados (1)" (Areia 5 metros). Mobile: "Adicionar material" (Descrição, Quantitativo). | `video2/frames-small/frame_0050_2529.17s.png` |
| 42:59 | RDO — Galeria + Anexos | Relatório | Galeria de fotos (8 fotos com caption por foto: "1.1 - Engenheiro civil de obra júnior com encargos complementares") + Seção Anexos. | `video2/frames-small/frame_0053_2579.60s.png` |
| 45:44 | Anexo áudio/vídeo | Relatório → Anexos | Player fullscreen preto com panorâmica da obra. Sidebar: "Anexos (1) → 01.m4a" (áudio!) com ActionSheet: Baixar arquivo / Excluir / Cancelar. | `video2/frames-small/frame_0055_2744.47s.png` |
| 47:05 | PDF preview | Relatório | Preview PDF "Relatório nº 3" com logos lado a lado, identificação da obra, efetivo tabela-style, atividades, ocorrências, materiais, galeria. Sidebar direita: painel "12/04/2019 nº 3" com contadores. | `video2/frames-small/frame_0057_2825.23s.png` |
| 48:54 | Lista de tarefas — progresso consolidado | Obra → Lista de tarefas | Tela cheia com KPIs (Total: 134, Em Andamento: 120, Não Iniciadas: 1, Concluídas: 13) + tabela hierárquica com % por linha (17%, 10% ...). | `video2/frames-small/frame_0059_2934.30s.png` |

---

## 3. Features observadas no competidor (lista consolidada)

### A. Autenticação & Tenant
- **A1.** Login mobile (e-mail + senha) com "Esqueceu a senha?" e self-signup trial ("Cadastrar minha conta de teste").
- **A2.** Tela de Empresa (tenant) com logomarca, razão social, CNPJ, telefone, plano ativo, limites (obras/usuários), data cadastro/contratação.
- **A3.** Planos escalonáveis (3 tiers com limites de obras e usuários).

### B. Cadastros globais (compartilhados entre obras)
- **B1.** **Mão de obra** em 3 abas: Categoria (Direta/Indireta/Terceiros), Padrão (catálogo de funções com horário default), Personalizada (pessoas concretas).
- **B2.** **Equipamentos** — catálogo simples (descrição) — 19 itens prontos no demo.
- **B3.** **Tipos de ocorrências** — 15 tipos pré-cadastrados (acidentes, alagamento, falta de material, greve, visita do fiscal, etc).
- **B4.** **Usuários** com avatares + agrupamento por papel (Administrador / Personalizado / Cliente obra).

### C. Obras
- **C1.** Lista de obras com card (foto + nome + status + contadores de relatórios).
- **C2.** Filtro por "grupo" (Prefeitura / Terceirizados / Todas).
- **C3.** Cadastro: Nome, Cliente, Data início, Previsão término, Endereço, Código do contrato, Status.
- **C4.** Foto de capa (picker nativo).

### D. Obra — Acompanhamento (sidebar)
- **D1.** **Visão geral** (dashboard da obra — não explorado em detalhe nos frames).
- **D2.** **Lista de tarefas (WBS)** — estrutura hierárquica 1.0 / 1.1 / 2.0 com **KPIs consolidados** (Total, Em Andamento, Não Iniciada, Concluída) e **% de execução por linha**.
- **D3.** **Importar lista de tarefas** via arquivo (upload + toast de progresso).
- **D4.** **Relatórios (RDOs)** — lista cronológica.
- **D5.** **Pesquisa avançada** com 8 sub-visões agregadas cross-RDO: Galeria de fotos, Atividades realizadas, Ocorrências, Comentários, Anexos, Clima/Tempo, Histórico mão de obra, Histórico equipamentos.

### E. Obra — Configurações
- **E1.** **Informações da obra** (editar básicos).
- **E2.** **Personalizar relatório**: logomarca do cliente + da empresa, título do relatório, **toggles por módulo** (Horário trabalho, Clima, Mão de obra, Equipamento, Atividade, Ocorrência, Controle de material — ativar/desativar individualmente na obra).
- **E3.** **Usuários da obra** (vinculação por obra, com papéis: Administrador, Personalizado, Cliente obra).
- **E4.** **Documentos da obra** com **pastas** (Financeiro, Plantas, ...) e download.

### F. RDO — Criação
- **F1.** **"Copiar informações do último relatório"** — toggle mestre + **sub-toggles granulares** (Clima, Mão de obra, Equipamentos, Atividades, Comentários).
- **F2.** **Salvar off-line** — toggle explícito no início.
- **F3.** Data picker wheel iOS.
- **F4.** Banner "Último relatório cadastrado: 18/10/2022 nº 36" (mostra último RDO para orientar).

### G. RDO — Seções
- **G1.** **Clima** por período (manhã/tarde/noite — inferido).
- **G2.** **Mão de obra** com modal de grupo (Direta/Indireta/Terceiros) + entrada/saída/intervalo + horas trabalhadas calculadas.
- **G3.** **Equipamentos** com stepper quantidade (+/-) e picker de catálogo.
- **G4.** **Atividades/Tarefas** linkadas à WBS com % e status (Iniciada, Em Andamento, Concluída, Não Iniciada, Paralisada, Não Executada).
- **G5.** **Ocorrências / Observações** com tag-tipo do catálogo global.
- **G6.** **Materiais recebidos** e **Materiais utilizados** separados (nome + quantitativo).
- **G7.** **Comentários** texto livre (separado de ocorrências).
- **G8.** **Galeria de fotos** com **caption por foto** ligada a tarefa (ex: "1.1 - Engenheiro civil..."). Picker nativo, até 30 fotos por seleção.
- **G9.** **Anexos** (áudio `.m4a`, vídeo, PDF) com baixar/excluir.
- **G10.** Status do relatório: Preenchimento iniciado / ...

### H. Saída
- **H1.** **PDF branded** com 2 logos lado a lado (empresa + cliente), header com metadados da obra/relatório, tabelas de efetivo, atividades, equipamentos, ocorrências, materiais, galeria.
- **H2.** Compartilhamento/visualização do PDF.

### I. UX transversais
- **I1.** Toast verde "Alterado com sucesso" após cada save.
- **I2.** Modal de confirmação "Excluir X? Esta ação não pode ser desfeita" com botão vermelho.
- **I3.** ActionSheet mobile (Editar / Excluir / Cancelar).
- **I4.** Tab bar mobile: Obras, Relatórios, [+] FAB central, Cadastros, Perfil.
- **I5.** Lado direito do web sempre com um "mobile preview" sincronizado — útil em vídeos de treinamento (não é produção).

---

## 4. Estado atual do Eldox v3

Baseado no código-fonte (`backend/src/diario/rdo/*` e `frontend-web/src/modules/diario/pages/*`):

### O que o Eldox JÁ TEM

| Área | Status | Evidência |
|---|---|---|
| **CRUD RDO** completo | Implementado | `rdo.controller.ts` — POST/GET/PATCH/DELETE `/rdos` |
| **Seções por RDO** (clima, mão de obra, equipamentos, atividades, ocorrências, checklist, fotos) | Implementado | PUT `/rdos/:id/clima`, `/mao-de-obra`, `/equipamentos`, `/atividades`, `/ocorrencias`, `/checklist`; model `RdoClima`, `RdoMaoDeObra`, `RdoEquipamento`, `RdoAtividade`, `RdoOcorrencia`, `RdoChecklistItem`, `RdoFoto` |
| **Assinatura digital** | Implementado | model `RdoAssinatura` |
| **Geração de PDF** | Implementado | `rdo-pdf.service.ts` + GET `/rdos/:id/pdf` |
| **Exportação XLS** (por RDO, por obra, horas) | Implementado | GET `/rdos/:id/exportar-xls`, `/obras/:obraId/exportar-xls`, `/obras/:obraId/exportar-horas` |
| **Avanço físico** (previsto x realizado) | Implementado | `rdo-avanco.service.ts` + GET `/obras/:obraId/avanco-fisico`, `/previsto-realizado` |
| **Cópia inteligente (campo `copiadoDeId`)** | Parcial | Schema tem campo, mas toggle hoje é "tudo ou nada" (`copiar_ultimo: boolean`) — falta granularidade por seção |
| **Agentes de IA** (sugestões de clima, mão de obra, validação) | Implementado | `rdo-ia.service.ts`, GET `/rdos/:id/sugestoes`, POST `/aplicar-sugestao`, POST `/validar` — pipeline multi-agente via BullMQ |
| **Fotos no RDO** | Implementado | POST/GET/DELETE `/rdos/:id/fotos` + `rdo-fotos.service.ts` + model `RdoFoto` |
| **Compartilhamento** | Implementado | PATCH `/rdos/:id/compartilhar` |
| **Workflow de aprovação** | Implementado | model `AprovacaoInstancia`, `AprovacaoDecisao`, módulo `aprovacoes` |
| **Obras (CRUD + localização + tipo)** | Implementado | model `Obra`, módulo `obras` |
| **Tenants + Planos** | Implementado | model `Tenant`, `Plano` |
| **Usuários + papéis** | Implementado | model `Usuario`, guards JWT + Roles |
| **GED (documentos)** | Implementado | módulo `ged` (ver MEMORY) |
| **Integração WhatsApp** | Implementado | `diario/whatsapp/` |
| **FVS, FVM, Concretagem, Ensaios, NCs, Semáforo PBQP-H** | Implementado | módulos dedicados — **não existem no competidor** |
| **Sincronização com Efetivo** | Implementado | POST `/rdos/:id/sincronizar-efetivo` |

### Páginas frontend existentes
- `DiarioHomePage.tsx` — lista de obras com criar RDO rápido.
- `RdosListPage.tsx` — lista de RDOs por obra.
- `RdoFormPage.tsx` (2213 linhas) — formulário monolítico de RDO com todas as seções.
- `RdoWorkflowPage.tsx` — tela de aprovação/workflow.
- `RelatorioClientePage.tsx` — visão cliente.

---

## 5. Gaps críticos (P0/P1)

Features que o competidor tem e o Eldox **não tem** (ou tem incompleto):

| # | Gap | Severidade | Esforço | Descrição |
|---|---|---|---|---|
| **G1** | **Catálogo global de Equipamentos** | P1 | 3d | Competidor tem 19 equipamentos pré-cadastrados reutilizáveis. Eldox só tem `doCatalogoId` futuro em `RdoEquipamento` — sem tabela `EquipamentoCatalogo` e sem tela de cadastro. |
| **G2** | **Catálogo global de Tipos de Ocorrência** | P1 | 2d | Competidor tem 15 tipos (acidente, greve, visita fiscal...). Eldox guarda ocorrências como texto livre — sem taxonomia. |
| **G3** | **Catálogo global de Funções/Mão de obra (Padrão + Personalizada)** | P1 | 3d | Competidor tem 3 camadas (Categoria / Padrão / Personalizada). Eldox guarda função como string livre em `RdoMaoDeObra.funcao`. Parcialmente resolvido pelo módulo `efetivo` mas não há UI de catálogo reutilizável no RDO. |
| **G4** | **Lista de Tarefas (WBS) por obra com % de execução** | P0 | 8d | Competidor tem estrutura 1.0/1.1/2.0 com KPIs consolidados (Total, Em Andamento, Não Iniciada, Concluída). Eldox tem `etapaTarefaId` futuro em `RdoAtividade` mas sem tabela de tarefas/WBS nem tela de acompanhamento. **Fundação do planejamento da obra.** |
| **G5** | **Importar lista de tarefas** (upload Excel/CSV) | P1 | 3d | Modal do competidor aceita upload de planilha com árvore hierárquica. Eldox não tem importador de WBS. |
| **G6** | **Cópia granular do último RDO** (sub-toggles por seção) | P0 | 2d | Eldox copia tudo ou nada. Competidor tem Clima / Mão de obra / Equipamentos / Atividades / Comentários independentes. **Fricção diária do usuário.** |
| **G7** | **Pesquisa avançada consolidada** (8 sub-visões cross-RDO) | P1 | 8d | Galeria de fotos, Atividades, Ocorrências, Comentários, Anexos, Clima, Histórico mão de obra, Histórico equipamentos — todas cruzando múltiplos RDOs com filtro por data. Eldox não tem essa visão agregada. |
| **G8** | **Personalizar relatório por obra** (logomarca cliente + toggles de seções no PDF) | P0 | 3d | Eldox gera PDF fixo. Competidor permite por obra: definir logomarca do cliente, título do relatório, habilitar/desabilitar cada seção no PDF final. |
| **G9** | **Documentos da obra em pastas** (Financeiro, Plantas, ...) | P1 | 4d | Eldox tem GED genérico. Competidor tem "pastas da obra" simples com download direto. Pode ser uma visão/filtro do GED. |
| **G10** | **Materiais recebidos × utilizados separados** | P1 | 2d | Competidor separa explicitamente "Materiais recebidos" de "Materiais utilizados". Eldox não tem seção de materiais no RDO. |
| **G11** | **Caption por foto ligada à atividade/tarefa** | P1 | 2d | Competidor permite legenda por foto com link à tarefa ("1.1 - Engenheiro..."). Eldox tem fotos mas sem caption+link tarefa. |
| **G12** | **Anexos áudio/vídeo/PDF no RDO** | P1 | 3d | Competidor aceita `.m4a` e outros tipos como anexo. Eldox só tem fotos em `RdoFoto`. |
| **G13** | **Comentários texto livre separados de ocorrências** | P1 | 1d | Competidor tem card "Comentários" distinto. Eldox mistura em ocorrências. |
| **G14** | **KPI cards no topo da lista de tarefas / RDO** | P1 | 2d | Cards Total/Em Andamento/Não Iniciada/Concluída. Eldox tem KPIs em dashboard mas não na lista de RDO/tarefas. |
| **G15** | **Auto-cálculo horas trabalhadas** (entrada − saída − intervalo) | P2 | 1d | Competidor calcula e mostra "07:00 hs" automaticamente. Eldox guarda horas de entrada/saída mas não calcula duração líquida em tela. |
| **G16** | **Self-signup trial (conta de teste)** | P2 | 3d | Botão "Cadastrar minha conta de teste" na tela de login. Eldox hoje é convite-only. |
| **G17** | **Filtros de obra por grupo** (Prefeitura, Terceirizados) | P2 | 2d | Permite segmentar carteira. Eldox tem `obraTipo` mas sem tag-grupo livre. |
| **G18** | **Status de obra com ícones de contadores na lista** | P2 | 1d | Card de obra mostra ícones de contadores (RDOs, atividades). Eldox tem mas pode ser ampliado. |
| **G19** | **Picker de equipamento com stepper +/-** | P2 | 1d | UX de quantidade. Eldox tem input numérico. |
| **G20** | **Banner "Último RDO: 18/10/2022 nº 36"** ao criar novo RDO | P2 | 1d | Pequeno helper que evita duplicata. |

**Total esforço gaps P0+P1:** ≈ **55 pessoas/dia** (gaps P0 = 13d; P1 = 42d).

---

## 6. Quick wins (≤ 2h cada)

| # | Quick win | Esforço | Arquivo |
|---|---|---|---|
| **QW1** | Banner "Último RDO: dd/mm/yyyy nº N" no modal de criação rápida | 2h | `DiarioHomePage.tsx` — `NovoRdoRapidoModal` |
| **QW2** | Auto-cálculo "Horas trabalhadas" (entrada − saída − intervalo) no form de mão de obra | 2h | `RdoFormPage.tsx` seção mão de obra |
| **QW3** | Modal de confirmação padronizado "Excluir X? Esta ação não pode ser desfeita" | 1h | componente `ConfirmDeleteModal.tsx` (criar) |
| **QW4** | Toast verde "Salvo com sucesso" após cada save (Se já existe, padronizar texto) | 1h | interceptor/toast service |
| **QW5** | Stepper +/- ao lado do input de quantidade de equipamento | 1.5h | `RdoFormPage.tsx` seção equipamentos |
| **QW6** | Caption editável em cada foto do RDO | 2h | `RdoFormPage.tsx` seção fotos + model `RdoFoto.caption` (migration) |
| **QW7** | KPI cards (Total/Em andamento/Concluído) acima da lista de RDOs | 2h | `RdosListPage.tsx` |
| **QW8** | Separar "Comentários gerais" de "Ocorrências" visualmente (collapse distinto) | 1h | `RdoFormPage.tsx` |
| **QW9** | Sub-toggles ao expandir "Copiar do último RDO" (Clima / Mão de obra / Equipamentos / Atividades / Comentários) — front only, backend já aceita flags | 2h | `NovoRdoRapidoModal` + contrato back |
| **QW10** | Filtro de obra por "grupo/tag" livre (input + chips) | 2h | `DiarioHomePage.tsx` |

**Total quick wins: ~17 h = 2 dias de 1 dev.**

---

## 7. Diferenciais do Eldox (o que o Eldox tem e o competidor NÃO tem)

| # | Diferencial | Valor |
|---|---|---|
| **D1** | **Agentes de IA** — pipeline multi-agente para sugestões de clima (API meteorológica), mão de obra (baseada em histórico), validação, resumo automático do RDO | Premium |
| **D2** | **FVS (Ficha de Verificação de Serviços)** — módulo completo Sprint 3+4 com templates por obra, 99 testes, SECURITY/AUDITOR aprovados | Premium — PBQP-H/ISO |
| **D3** | **FVM (Ficha de Verificação de Materiais)** | Premium |
| **D4** | **Concretagem** (croqui, controle tecnológico) | Premium — PBQP-H |
| **D5** | **Ensaios Laboratoriais** (Sprint 5+6 completos, EldoX.IA extração de PDF, alertas BullMQ + WhatsApp) | Premium — controle tecnológico |
| **D6** | **Não Conformidades (NCs)** + Planos de Ação | Premium — ISO 9001 |
| **D7** | **Semáforo PBQP-H** consolidado por obra | Premium — compliance |
| **D8** | **Workflow de Aprovações** (template de etapas, instâncias, decisões) | Enterprise |
| **D9** | **GED Enterprise** (hash SHA-256, versionamento, OCR/pdftotext, QR Code, confidencialidade, acesso externo) | Premium |
| **D10** | **Integração WhatsApp** oficial (templates, webhooks) | Enterprise |
| **D11** | **Controle de efetivo** separado (`EmpresaEfetivo`, `RegistroEfetivo`) com sincronização bidirecional | Premium |
| **D12** | **Dashboard executivo** multi-obra | Enterprise |
| **D13** | **Avanço físico × previsto** por atividade com registro de quantidade executada | Premium |
| **D14** | **Assinatura digital** do RDO | Compliance |
| **D15** | **Multi-tenant hard-isolation** com `TenantId` em 100% das queries + `multi-tenant-validator` skill | Enterprise |

**Conclusão:** O Eldox é **10x mais amplo**. O competidor entrega o "RDO bonito" com alto polimento de UX; o Eldox entrega o **sistema completo de qualidade da obra**. A oportunidade não é competir em features — é **polir a UX do RDO** para não perder em apresentação comercial.

---

## 8. Sprints propostos (3 sprints de 5 dias, 2 devs + PO-COPILOT)

### 🟢 Sprint DC-01 — "Paridade de UX com o competidor" (5 dias)
**Objetivo:** fechar todos os quick-wins + gaps P0 que mais aparecem em demo.

| Dia | Entrega |
|---|---|
| D1 | QW1 (banner último RDO) + QW2 (auto-cálculo horas) + QW4 (toast padrão) + QW3 (modal confirmação) |
| D2 | **G6 — Cópia granular com sub-toggles** (P0, 2d backend+front) |
| D3 | Fim G6 + QW6 (caption em foto, migration `rdo_fotos.caption`) + QW5 (stepper) |
| D4 | **G8 parte 1 — Personalizar relatório por obra** (logomarca cliente upload + toggles de seções no PDF) |
| D5 | G8 parte 2 (fim) + QW7 (KPI cards na lista) + QW9 (sub-toggles UI) + QW8 (separar comentários) + teste integrado |

**Artefatos:** ADR novo "Cópia granular do último RDO", migration `rdo_fotos.caption`, novo campo `Obra.relatorio_config (JSON)`, componente `<ConfirmDeleteModal>`.

---

### 🟡 Sprint DC-02 — "Catálogos globais + Materiais" (5 dias)
**Objetivo:** dar ao Eldox o que o competidor usa como "cadastros globais" + seção de materiais no RDO.

| Dia | Entrega |
|---|---|
| D1 | **G1 — Catálogo Equipamentos** (schema `EquipamentoCatalogo`, migration, CRUD, tela `CatalogoEquipamentosPage`) |
| D2 | G1 fim + integração no `RdoFormPage` (picker a partir do catálogo) + fallback legado |
| D3 | **G2 — Catálogo Tipos de Ocorrência** (schema, CRUD, seed com 15 tipos padrão, integração RDO) |
| D4 | **G3 — Catálogo Funções (Padrão + Personalizada)** com abas Categoria/Padrão/Personalizada (reuso do módulo `efetivo`) |
| D5 | **G10 — Materiais recebidos × utilizados** no RDO (novos models `RdoMaterial` com `tipo=RECEBIDO|UTILIZADO`) + **G12 — Anexos áudio/vídeo** (`RdoAnexo` genérico) |

**Artefatos:** 3 novas tabelas de catálogo, seed PBQP-H-aware, ADRs, skills `multi-tenant-validator` no CI.

---

### 🔵 Sprint DC-03 — "WBS + Pesquisa avançada + Obra Hub" (5 dias)
**Objetivo:** o grande diferencial do competidor — **Lista de tarefas da obra** com KPIs e **8 visões agregadas** cross-RDO.

| Dia | Entrega |
|---|---|
| D1 | **G4 — Schema WBS** (`ObraTarefa` hierárquica 1.0/1.1/2.0 com `parentId`, `percentual_executado`, `status`) + migration + CRUD básico |
| D2 | G4 — Tela `ObraTarefasPage` (árvore + KPI cards) + ligação `RdoAtividade.obra_tarefa_id` (já existe `etapaTarefaId`, formalizar) |
| D3 | **G5 — Importador** XLSX/CSV para tarefas (upload + parse + preview + commit) |
| D4 | **G7 — Pesquisa Avançada** (8 sub-telas ou 1 tela com tabs): Galeria consolidada, Atividades realizadas, Ocorrências, Comentários, Anexos, Clima, Histórico mão de obra, Histórico equipamentos — queries SQL com filtros de data e cache em `SemaforoPbqphCache`-pattern |
| D5 | **G9 — Documentos da obra em pastas** (view sobre GED com estrutura de pastas `Financeiro`, `Plantas`, etc) + **G14 — KPI cards na lista de RDO** + polimento |

**Artefatos:** novo módulo `obra-tarefas` backend, novo hub de visões agregadas frontend (rota `/obras/:id/pesquisa-avancada`), reuso do módulo GED para pastas.

---

### ⚫ Sprint DC-04 (opcional) — "Self-serve + polimento comercial" (5 dias)
**Objetivo:** reduzir atrito comercial para fechar o ciclo.

| Dia | Entrega |
|---|---|
| D1-2 | **G16 — Self-signup trial** (rota pública `/signup`, tenant auto-criado, plano FREE 30 dias) |
| D3 | **G17 — Filtros por grupo/tag livre de obra** |
| D4 | **G13 — Comentários gerais separados** no backend (não só UI) + **G20 — Banner último RDO** polido |
| D5 | **G19 — Stepper everywhere** + **G18 — Enriquecer card de obra** (contadores) + testes e2e |

---

## 9. Notas de observação final

- O competidor **não tem nenhuma verificação de qualidade PBQP-H** — o Eldox domina esse pilar por larga margem.
- O competidor **tem um PDF muito bem feito** (logomarca dupla, layout enxuto) — oportunidade para o Eldox evoluir o `rdo-pdf.service.ts` com template customizável por tenant/obra.
- A **tab bar mobile** do competidor (Obras, Relatórios, [+], Cadastros, Perfil) é uma referência limpa para quando o Eldox tiver app mobile dedicado.
- A **"Pesquisa avançada"** (8 visões agregadas) é, na prática, um **dashboard analítico da obra** — o Eldox tem insumos para algo equivalente ou melhor via agentes IA (`rdo-ia.service`), mas precisa das views.
- Nenhum frame mostrou integração com WhatsApp, workflow de aprovação formal, ou qualquer módulo de qualidade no competidor → essas continuam sendo **barreiras de entrada** fortes do Eldox.

---

**Links rápidos:**
- Frames vídeo 1: `/docs/superpowers/specs/diario-competitor/video1/frames-small/`
- Frames vídeo 2: `/docs/superpowers/specs/diario-competitor/video2/frames-small/`
- Código Eldox analisado: `/backend/src/diario/rdo/`, `/frontend-web/src/modules/diario/pages/`, `/backend/prisma/schema.prisma` (models `Rdo`, `RdoClima`, `RdoMaoDeObra`, `RdoEquipamento`, `RdoAtividade`, `RdoOcorrencia`, `RdoFoto`)
