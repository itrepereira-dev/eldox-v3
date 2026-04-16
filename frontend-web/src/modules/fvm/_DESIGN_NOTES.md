# FVM — Design Notes e Comparação com Spec v3

## Arquitetura de Telas

```
/fvm/obras/:obraId            → GradeMateriaisPage     (≡ FVS: FichaGradePage)
/fvm/lotes/:loteId            → FichaLotePage          (≡ FVS: FichaLocalPage)
/fvm/catalogo                 → CatalogoMateriaisPage  (≡ FVS: CatalogoPage)
/fvm/fornecedores             → FornecedoresPage       (a criar)
```

**Componentes:**
```
grade/
  pages/
    GradeMateriaisPage.tsx    ✅ criado
    FichaLotePage.tsx         ✅ criado
  components/
    LoteDrawer.tsx            ✅ criado  (≡ GradeDrawer)
    NovoLoteModal.tsx         ✅ criado  (≡ AbrirFichaWizard)
  hooks/
    useGradeFvm.ts            ✅ criado  (≡ useGrade + useFichas)

catalogo/
  pages/
    CatalogoMateriaisPage.tsx ✅ criado  (≡ CatalogoPage)
  components/
    MaterialModal.tsx         ⬜ a criar (≡ ServicoModal)
  hooks/
    useCatalogoFvm.ts         ⬜ a criar (≡ useCatalogo)
```

## Comparação Spec v3 → Design Gerado

| Seção da Spec v3              | Coberta no design?  | Arquivo                   |
|-------------------------------|---------------------|---------------------------|
| §4 Grade Visual Mat × Lote    | ✅ Completa          | GradeMateriaisPage.tsx    |
| §2.6.1 Ciclo de status lote   | ✅ CELL_CLS+CELL_ICON| GradeMateriaisPage.tsx    |
| Drawer de preview de célula   | ✅ Completo          | LoteDrawer.tsx            |
| Criação de lote (nova entrega)| ✅ Completo          | NovoLoteModal.tsx         |
| Criação inline de fornecedor  | ✅ Crítico resolvido | NovoLoteModal.tsx         |
| §3.3 Registros de verificação | ✅ Com NC obrigatória| FichaLotePage.tsx         |
| Modal de decisão final        | ✅ 4 opções + campos | FichaLotePage.tsx         |
| §3.1 Catálogo de materiais    | ✅ Split-panel       | CatalogoMateriaisPage.tsx |
| §2.5 Fornecedores             | ⬜ FornecedoresPage  | a criar                   |
| §8 Avaliação fornecedores     | ⬜                   | a criar (Sprint 2+)       |
| §7 Rastreabilidade de uso     | ⬜                   | a criar (Sprint 3)        |
| §12 Camada IA                 | ⬜ Sprint 4-7        | fora do escopo agora      |

## Padrões FVS herdados (garantia de consistência visual)

| Padrão FVS                        | Aplicado no FVM                     |
|-----------------------------------|-------------------------------------|
| CELL_CLS + CELL_ICON              | StatusLote → mesmos tipos e formato |
| Filtros URL-synced                | categoria= e status= na URL         |
| Sticky col esquerda na grade      | Material sticky left z-10           |
| Barra de progresso                | aprovados/total × 100%              |
| GradeDrawer (overlay + drawer)    | LoteDrawer idêntico em estrutura    |
| Lista com tabela + badge status   | LoteDrawer.tsx + FichasListPage     |
| CSS variables Precision Ops Dark  | Todos os arquivos — zero hardcoded  |
| TanStack Query + invalidateQueries| useGradeFvm.ts — mesmo padrão       |
| React Hook Form + Zod             | NovoLoteModal.tsx                   |

## Diferenças Necessárias FVM vs FVS

| Aspecto               | FVS                      | FVM (adaptação)                    |
|-----------------------|--------------------------|------------------------------------|
| Eixo X da grade       | Locais fixos da obra     | Lotes dinâmicos (crescem no tempo) |
| Criar inspecção       | Wizard 3 passos          | NovoLoteModal com fornecedor inline|
| Modal de decisão      | Aprovado / NC            | 4 opções + quarentena com prazo    |
| Botões de item        | Grid de seleção          | ✓ / ✗ / — por item (mais rápido)  |

## Próximos Passos de Implementação

1. `MaterialModal.tsx` — formulário de material com tabs (Dados / Itens / Documentos)
2. `useCatalogoFvm.ts` — hooks de catálogo
3. `fvm.service.ts` — service layer com todos os endpoints da spec §5
4. `FornecedoresPage.tsx` — listagem com score e situação
5. Migration SQL com os 13 modelos do §2 + campos `hora_chegada` + `quantidade_nf`
