# Auditoria E2E Eldox — https://sistema.eldox.com.br

- Data/hora: 2026-04-20 11:05:45
- Rotas visitadas: 57
- Achados totais: 8
- Distribuicao: CRIT:2 · ALTO:2 · MEDIO:4

## Resumo por modulo

| Modulo | Rotas | Erros console | Erros runtime | Falhas rede | Status |
|---|---|---|---|---|---|
| Admin | 3 | 0 | 0 | 0 | OK |
| Almoxarifado | 15 | 1 | 0 | 1 | AVISO |
| Aprovacoes | 2 | 1 | 0 | 1 | AVISO |
| Concretagem | 5 | 0 | 0 | 0 | OK |
| Dashboard | 1 | 0 | 0 | 0 | OK |
| Diario | 2 | 0 | 0 | 0 | OK |
| Efetivo | 2 | 0 | 0 | 0 | OK |
| Ensaios | 4 | 0 | 0 | 0 | OK |
| FVM | 3 | 0 | 0 | 0 | OK |
| FVS | 7 | 1 | 0 | 1 | AVISO |
| GED | 4 | 0 | 0 | 0 | OK |
| NC | 2 | 0 | 0 | 0 | OK |
| Obras | 3 | 0 | 0 | 0 | OK |
| PlanosAcao | 2 | 0 | 0 | 0 | OK |
| Semaforo | 2 | 1 | 0 | 1 | AVISO |

## Achados por severidade

### CRIT (2)

**[CRIT001] FVS — /obras/3/fvs/dashboard**
- Categoria: `network`
- Resumo: Request GET fvs/dashboard/obras/3/dashboard-graficos falhou (500)
- Detalhes: `{"url": "https://sistema.eldox.com.br/api/v1/fvs/dashboard/obras/3/dashboard-graficos?data_inicio=2026-03-23&data_fim=2026-04-20&granularidade=semana", "method": "GET", "status": 500}`
- Screenshot: `screenshots/obras_3_fvs_dashboard.png`

**[CRIT002] Semaforo — /obras/3/semaforo**
- Categoria: `network`
- Resumo: Request GET obras/3/semaforo falhou (500)
- Detalhes: `{"url": "https://sistema.eldox.com.br/api/v1/obras/3/semaforo", "method": "GET", "status": 500}`
- Screenshot: `screenshots/obras_3_semaforo.png`

### ALTO (2)

**[ALTO001] Almoxarifado — /almoxarifado/ocs**
- Categoria: `network`
- Resumo: Request GET almoxarifado/ordens-compra falhou (404)
- Detalhes: `{"url": "https://sistema.eldox.com.br/api/v1/almoxarifado/ordens-compra", "method": "GET", "status": 404}`
- Screenshot: `screenshots/almoxarifado_ocs.png`

**[ALTO002] Aprovacoes — /aprovacoes/templates**
- Categoria: `network`
- Resumo: Request GET aprovacoes/templates falhou (400)
- Detalhes: `{"url": "https://sistema.eldox.com.br/api/v1/aprovacoes/templates", "method": "GET", "status": 400}`
- Screenshot: `screenshots/aprovacoes_templates.png`

### MEDIO (4)

**[MEDIO001] Almoxarifado — /almoxarifado/ocs**
- Categoria: `console`
- Resumo: console.error: Failed to load resource: the server responded with a status of 404 ()
- Detalhes: `Failed to load resource: the server responded with a status of 404 ()`
- Screenshot: `screenshots/almoxarifado_ocs.png`

**[MEDIO002] Aprovacoes — /aprovacoes/templates**
- Categoria: `console`
- Resumo: console.error: Failed to load resource: the server responded with a status of 400 ()
- Detalhes: `Failed to load resource: the server responded with a status of 400 ()`
- Screenshot: `screenshots/aprovacoes_templates.png`

**[MEDIO003] FVS — /obras/3/fvs/dashboard**
- Categoria: `console`
- Resumo: console.error: Failed to load resource: the server responded with a status of 500 ()
- Detalhes: `Failed to load resource: the server responded with a status of 500 ()`
- Screenshot: `screenshots/obras_3_fvs_dashboard.png`

**[MEDIO004] Semaforo — /obras/3/semaforo**
- Categoria: `console`
- Resumo: console.error: Failed to load resource: the server responded with a status of 500 ()
- Detalhes: `Failed to load resource: the server responded with a status of 500 ()`
- Screenshot: `screenshots/obras_3_semaforo.png`


## Rotas visitadas (detalhe)

| Modulo | Rota | HTTP | Load (ms) | Titulo renderizado | Obs |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | 200 | 1008 | Bom dia, Itamar 👋 |  |
| Obras | `/obras` | 200 | 922 | Obras (1 obra) |  |
| Obras | `/obras/nova` | 200 | 925 | Nova Obra |  |
| Obras | `/obras/3` | 200 | 1044 | Teste |  |
| GED | `/obras/3/ged` | 200 | 982 | GED — Teste |  |
| GED | `/obras/3/ged/documentos` | 200 | 976 | Documentos |  |
| GED | `/obras/3/ged/lista-mestra` | 200 | 973 | Lista Mestra |  |
| GED | `/ged/admin` | 200 | 925 | GED — Documentos da Empresa |  |
| FVS | `/configuracoes/fvs/catalogo` | 200 | 919 | Catálogo de Serviços FVS |  |
| FVS | `/fvs/modelos` | 200 | 910 | Templates de Inspeção |  |
| FVS | `/fvs/modelos/novo` | 200 | 606 | Novo Template de Inspeção |  |
| FVS | `/fvs/fichas` | 200 | 951 | Inspeções |  |
| FVS | `/fvs/fichas/nova` | 200 | 966 | Nova Inspeção — Selecionar Obra |  |
| FVS | `/fvs/dashboard` | 200 | 922 | Dashboard FVS — Todas as Obras |  |
| FVS | `/obras/3/fvs/dashboard` | 200 | 1007 | Dashboard FVS |  |
| FVM | `/fvm/catalogo` | 200 | 919 | Catálogo de Materiais |  |
| FVM | `/fvm/fornecedores` | 200 | 912 | Fornecedores |  |
| FVM | `/fvm/obras/3` | 200 | 921 | Controle de Materiais |  |
| Diario | `/diario` | 200 | 925 | Diário de Obras |  |
| Diario | `/obras/3/diario` | 200 | 937 | Diário de Obra |  |
| Ensaios | `/configuracoes/ensaios/tipos` | 200 | 916 | Tipos de Ensaio |  |
| Ensaios | `/obras/3/ensaios` | 200 | 925 | Conformidade de Materiais |  |
| Ensaios | `/obras/3/ensaios/laboratoriais` | 200 | 929 | Ensaios Laboratoriais |  |
| Ensaios | `/obras/3/ensaios/revisoes` | 200 | 921 | Revisão de Laudos |  |
| Concretagem | `/concretagem` | 200 | 605 | Concretagem |  |
| Concretagem | `/concretagem/concretagens` | 200 | 925 | Gestão de Concretagens |  |
| Concretagem | `/obras/3/concretagem` | 200 | 939 | Concretagem |  |
| Concretagem | `/obras/3/concretagem/concretagens` | 200 | 923 | Gestão de Concretagens |  |
| Concretagem | `/obras/3/concretagem/croqui` | 200 | 927 | Croquis de Rastreabilidade |  |
| Almoxarifado | `/almoxarifado` | 200 | 942 | Almoxarifado |  |
| Almoxarifado | `/almoxarifado/estoque` | 200 | 928 | Estoque |  |
| Almoxarifado | `/almoxarifado/estoque/movimentos` | 200 | 915 | Movimentos |  |
| Almoxarifado | `/almoxarifado/estoque/alertas` | 200 | 925 | Alertas de Estoque |  |
| Almoxarifado | `/almoxarifado/transferencias` | 200 | 920 | Transferências |  |
| Almoxarifado | `/almoxarifado/locais` | 200 | 925 | Locais de Estoque |  |
| Almoxarifado | `/almoxarifado/conversoes` | 200 | 917 | Conversão de Unidades |  |
| Almoxarifado | `/almoxarifado/solicitacoes` | 200 | 921 | Solicitações de Compra |  |
| Almoxarifado | `/almoxarifado/solicitacoes/nova` | 200 | 916 | Nova Solicitação de Compra |  |
| Almoxarifado | `/almoxarifado/ocs` | 200 | 916 | Ordens de Compra |  |
| Almoxarifado | `/almoxarifado/ocs/nova` | 200 | 913 | Nova Ordem de Compra |  |
| Almoxarifado | `/almoxarifado/nfes` | 200 | 920 | Notas Fiscais Recebidas |  |
| Almoxarifado | `/almoxarifado/nfes/upload` | 200 | 575 | Importar NF-e via XML |  |
| Almoxarifado | `/almoxarifado/planejamento` | 200 | 582 | Planejamento de Consumo |  |
| Almoxarifado | `/almoxarifado/insights` | 200 | 916 | IA Preditiva |  |
| NC | `/ncs` | 200 | 924 | Painel Global de NCs |  |
| NC | `/obras/3/ncs` | 200 | 917 | Não Conformidades |  |
| Semaforo | `/semaforo` | 200 | 606 |  |  |
| Semaforo | `/obras/3/semaforo` | 200 | 923 |  |  |
| Aprovacoes | `/aprovacoes` | 200 | 949 | Central de Aprovações |  |
| Aprovacoes | `/aprovacoes/templates` | 200 | 916 | Templates de Aprovação |  |
| Efetivo | `/obras/3/efetivo` | 200 | 937 | Controle de Efetivo |  |
| Efetivo | `/configuracoes/efetivo/cadastros` | 200 | 925 | Cadastros — Efetivo |  |
| PlanosAcao | `/obras/3/fvs/planos-acao` | 200 | 933 | Planos de Ação |  |
| PlanosAcao | `/configuracoes/planos-acao` | 200 | 916 | Configuração — Planos de Ação |  |
| Admin | `/admin/usuarios` | 200 | 918 | Usuários |  |
| Admin | `/admin/usuarios/novo` | 200 | 915 | Novo usuário |  |
| Admin | `/admin/perfis-acesso` | 200 | 918 | Perfis de acesso |  |

## Links expostos na shell (sidebar + topbar)

| Href | Label |
|---|---|
| `/esqueci-senha` | Esqueci a senha |