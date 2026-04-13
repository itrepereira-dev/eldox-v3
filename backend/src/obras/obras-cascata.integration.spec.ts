// src/obras/obras-cascata.integration.spec.ts
// Testes de integração para POST /obras/:id/locais/gerar-cascata
// Rodam contra banco de teste (NODE_ENV=test)
// Marcados como .todo para execução futura no CI com banco real disponível
import { Test, TestingModule } from '@nestjs/testing';
import { ObrasService } from './obras.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenericaStrategy } from './strategies/generica.strategy';
import { EdificacaoStrategy } from './strategies/edificacao.strategy';
import { LinearStrategy } from './strategies/linear.strategy';
import { InstalacaoStrategy } from './strategies/instalacao.strategy';

describe('ObrasService.gerarCascata (integração)', () => {
  // Nota: esses testes rodam contra o banco de teste (NODE_ENV=test)
  // Setup: precisa de um tenant + obra existente no banco de teste
  // Por ora, marcar como skip se banco não disponível no CI

  it.todo('genérica: gera 2 níveis com nomeCompleto correto no banco');
  it.todo('edificação: bloco A com 3 andares × 2 APs = 9 registros no banco');
  it.todo('linear: 2 trechos × 2 PVs cada = 6 registros com km no dadosExtras');
  it.todo('instalação: 2 áreas × 3 módulos = 8 registros no banco');
});
