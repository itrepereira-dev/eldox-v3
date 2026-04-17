# Importação de Estoque via Planilha — Design Spec

**Data:** 2026-04-17
**Status:** Aprovado

---

## Goal

Permitir que o usuário importe o estoque inicial do almoxarifado a partir de um arquivo `.xlsx`: cria ou atualiza itens no catálogo de materiais e define/incrementa o saldo em um local de armazenamento específico.

## Contexto

O almoxarifado já possui catálogo (`fvm_catalogo_materiais`), saldo (`alm_estoque_saldo`) e movimentos (`alm_movimentos`). Não existe ainda nenhum mecanismo de carga em lote — o usuário precisaria cadastrar cada material manualmente. ExcelJS já está instalado em frontend e backend.

## Decisões de Design

| Questão | Decisão |
|---|---|
| O que importa? | Catálogo + saldo inicial (cria material e seta quantidade) |
| Conflito de catálogo | Atualiza o item existente + **soma** ao saldo atual |
| Local de destino | Selecionado pelo usuário antes do upload (todas as linhas vão para o mesmo local) |
| Erro em linha | Linha com erro é pulada; demais são processadas normalmente |
| Formato | `.xlsx` (não CSV) |

---

## Template Excel

### Aba "Importação"

| Coluna | Obrigatório | Tipo | Observações |
|---|---|---|---|
| Código | Não | VARCHAR(50) | Se preenchido, busca item no catálogo por código; se vazio, busca por nome |
| Nome do Material | **Sim** | VARCHAR(200) | Usado como fallback de busca quando código está vazio |
| Categoria | Não | VARCHAR(100) | Nome da categoria; se não existir no tenant, é criada automaticamente |
| Unidade | **Sim** | enum | Dropdown validado: `un kg m m² m³ L cx sc gl pc` |
| Quantidade | **Sim** | NUMERIC ≥ 0 | Somada ao saldo existente |
| Estoque Mínimo | Não | NUMERIC ≥ 0 | Atualiza o campo `estoque_min`; se vazio, mantém o valor atual (ou 0 para item novo) |
| Observação | Não | TEXT | Registrada no movimento gerado |

### Aba "Instruções"

Explica cada campo, exemplos preenchidos e regras de conflito/erro.

---

## Backend

### Arquivos

| Arquivo | Alteração |
|---|---|
| `backend/src/almoxarifado/estoque/estoque.service.ts` | Adiciona `gerarTemplate(): Buffer` e `importar(file, localId, tenantId, usuarioId)` |
| `backend/src/almoxarifado/estoque/estoque.controller.ts` | Adiciona 2 endpoints |

### Endpoints

```
GET  /api/v1/almoxarifado/estoque/importar/template
  → Retorna buffer .xlsx com template pré-formatado
  → Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  → Content-Disposition: attachment; filename="modelo-importacao-estoque.xlsx"
  → Roles: ADMIN_TENANT, ENGENHEIRO

POST /api/v1/almoxarifado/estoque/importar
  → Body: multipart/form-data { file: .xlsx, local_id: string }
  → Roles: ADMIN_TENANT, ENGENHEIRO
  → Resposta: ImportacaoResultado
```

### Lógica de Importação (por linha)

```
Para cada linha da aba "Importação":
  1. Validar campos obrigatórios (nome, unidade, quantidade)
     → Erro: pula a linha, registra em erros[]

  2. Buscar item no catálogo:
     a. Se código preenchido → WHERE tenant_id=$1 AND codigo=$2
     b. Se não → WHERE tenant_id=$1 AND LOWER(nome)=LOWER($2)

  3. Se não existe → INSERT em fvm_catalogo_materiais
     (nome, codigo, unidade, estoque_min, categoria_id, tenant_id)

  4. Se existe → UPDATE nome, unidade, estoque_min (se fornecidos)

  5. Se categoria informada e não existe → INSERT em fvm_categorias_materiais
     → Aviso registrado em avisos[]

  6. UPSERT em alm_estoque_saldo:
     ON CONFLICT (tenant_id, local_id, catalogo_id)
     DO UPDATE SET quantidade = quantidade + EXCLUDED.quantidade,
                   estoque_min = EXCLUDED.estoque_min,   -- se fornecido
                   updated_at = NOW()

  7. INSERT em alm_movimentos:
     tipo='entrada', referencia_tipo='manual',
     observacao = observacao_da_linha ?? 'Importação via planilha',
     saldo_anterior, saldo_posterior, criado_por
```

### Tipo de Retorno

```typescript
interface ImportacaoResultado {
  processadas: number
  erros: Array<{ linha: number; motivo: string }>
  avisos: Array<{ linha: number; motivo: string }>
}
```

### Validações Adicionais

- Arquivo deve ser `.xlsx` (Content-Type validado no controller com `FileInterceptor`)
- Tamanho máximo: 5 MB
- `local_id` deve pertencer ao `tenantId` do usuário autenticado
- `quantidade` deve ser numérico ≥ 0
- `unidade` deve ser um dos valores permitidos: `un kg m m² m³ L cx sc gl pc`

---

## Frontend

### Arquivos

| Arquivo | Alteração |
|---|---|
| `frontend-web/src/modules/almoxarifado/estoque/components/ImportarPlanilhaModal.tsx` | Novo componente |
| `frontend-web/src/modules/almoxarifado/estoque/pages/EstoquePage.tsx` | Botão + wiring do modal |
| `frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts` | 2 métodos novos |

### Métodos no Service

```typescript
downloadTemplateEstoque(): Promise<void>
  GET /almoxarifado/estoque/importar/template
  → Dispara download do arquivo via blob

importarEstoque(localId: number, file: File): Promise<ImportacaoResultado>
  POST /almoxarifado/estoque/importar
  → multipart/form-data
```

### Modal — 3 Etapas

**Etapa 1 — Configurar**
- Dropdown "Local de destino" — lista `alm_locais` ativos do tenant (obrigatório)
- Link "Baixar modelo (.xlsx)" — chama `downloadTemplateEstoque()`

**Etapa 2 — Upload**
- Área drag-and-drop (aceita apenas `.xlsx`, máx 5 MB)
- Ao selecionar: exibe nome + tamanho do arquivo
- Botão "Importar" habilitado apenas quando local + arquivo selecionados
- Loading state durante o upload

**Etapa 3 — Resultado**
- Resumo: `N itens processados · X erros · Y avisos`
- Se erros/avisos: tabela com colunas Linha | Tipo | Motivo
- Botão "Fechar" — ao fechar, invalida `['alm-estoque']` no React Query

### EstoquePage

Botão **"Importar Planilha"** adicionado na toolbar (ao lado de "Transferência" e "Movimento Manual"), visível apenas para roles ADMIN_TENANT e ENGENHEIRO.

---

## Fluxo Completo

```
Usuário abre EstoquePage
  └─► Clica "Importar Planilha"
        └─► Modal abre na Etapa 1
              └─► Seleciona Local: "Depósito Central"
              └─► Clica "Baixar modelo (.xlsx)"
                    GET /estoque/importar/template → download
              └─► Preenche planilha, salva
              └─► Arrasta arquivo para a área de upload
              └─► Clica "Importar"
                    POST /estoque/importar { file, local_id: 3 }
                    └─► 12 linhas processadas, 0 erros, 1 aviso
                          (categoria "Elétrica" criada automaticamente)
              └─► Vê resultado, fecha modal
              └─► Lista de estoque recarrega com novos saldos
```

## O que NÃO está no escopo

- Exportar estoque atual para planilha (fase 2)
- Importar para múltiplos locais em um único upload
- Preview das linhas antes de confirmar a importação
- Desfazer uma importação
