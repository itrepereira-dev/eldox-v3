// backend/src/almoxarifado/almoxarifado.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { IaModule } from '../ia/ia.module';
import { GedModule } from '../ged/ged.module';

// Estoque
import { EstoqueService } from './estoque/estoque.service';
import { EstoqueController } from './estoque/estoque.controller';

// Orçamento
import { OrcamentoService } from './orcamento/orcamento.service';
import { OrcamentoController } from './orcamento/orcamento.controller';

// Solicitações
import { SolicitacaoService } from './solicitacao/solicitacao.service';
import { SolicitacaoController } from './solicitacao/solicitacao.controller';

// Compras (OC)
import { ComprasService } from './compras/compras.service';
import { ComprasController } from './compras/compras.controller';

// NF-e
import { NfeService } from './nfe/nfe.service';
import { NfeMatchService } from './nfe/nfe-match.service';
import { NfeController } from './nfe/nfe.controller';

// IA Preditiva + Catálogo
import { AgenteReorderService } from './ia/agente-reorder.service';
import { AgenteAnomaliaService } from './ia/agente-anomalia.service';
import { AgenteCatalogoService } from './ia/agente-catalogo.service';
import { IaController } from './ia/ia.controller';
import { VariantesController } from './ia/variantes.controller';

// SINAPI
import { SinapiService } from './sinapi/sinapi.service';
import { SinapiController } from './sinapi/sinapi.controller';

// Cotações
import { CotacoesService } from './cotacoes/cotacoes.service';
import { CotacoesController } from './cotacoes/cotacoes.controller';
import { PortalFornecedorController } from './cotacoes/portal-fornecedor.controller';

// Planejamento
import { PlanejamentoService } from './planejamento/planejamento.service';
import { PlanejamentoController } from './planejamento/planejamento.controller';

// Conversão de unidades
import { ConversaoService } from './conversao/conversao.service';

// Locais (NEW)
import { LocaisService } from './locais/locais.service';
import { LocaisController } from './locais/locais.controller';

// Transferências (NEW)
import { TransferenciasService } from './transferencias/transferencias.service';
import { TransferenciasController } from './transferencias/transferencias.controller';

// Config de Transferência (NEW)
import { ConfigTransferenciaService } from './config-transferencia/config-transferencia.service';
import { ConfigTransferenciaController } from './config-transferencia/config-transferencia.controller';

// Jobs Bull
import { AlmoxarifadoProcessor } from './jobs/almoxarifado.processor';

@Module({
  imports: [
    PrismaModule,
    IaModule,
    GedModule,   // fornece MinioService para upload de XML/PDF

    BullModule.registerQueue({
      name: 'almoxarifado',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      },
    }),

    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB — planilhas xlsx podem ser grandes
      },
    }),
  ],
  controllers: [
    EstoqueController,
    OrcamentoController,
    SolicitacaoController,
    ComprasController,
    NfeController,
    IaController,
    PlanejamentoController,
    VariantesController,
    SinapiController,
    CotacoesController,
    PortalFornecedorController,
    LocaisController,
    TransferenciasController,
    ConfigTransferenciaController,
  ],
  providers: [
    EstoqueService,
    OrcamentoService,
    ConversaoService,
    SolicitacaoService,
    ComprasService,
    NfeService,
    NfeMatchService,
    AgenteReorderService,
    AgenteAnomaliaService,
    AgenteCatalogoService,
    SinapiService,
    CotacoesService,
    PlanejamentoService,
    AlmoxarifadoProcessor,
    LocaisService,
    TransferenciasService,
    ConfigTransferenciaService,
  ],
  exports: [
    EstoqueService,
    OrcamentoService,
    ConversaoService,
    AgenteCatalogoService,
    LocaisService,
  ],
})
export class AlmoxarifadoModule {}
