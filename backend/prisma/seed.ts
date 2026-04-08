import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // ─────────────────────────────────────────
  // PLANOS
  // ─────────────────────────────────────────
  await prisma.plano.upsert({
    where: { nome: 'starter' },
    update: {},
    create: { nome: 'starter', limites: { obras: 3, usuarios: 5, storage_gb: 5 } },
  });
  await prisma.plano.upsert({
    where: { nome: 'pro' },
    update: {},
    create: { nome: 'pro', limites: { obras: 20, usuarios: 30, storage_gb: 50 } },
  });
  await prisma.plano.upsert({
    where: { nome: 'corporativo' },
    update: {},
    create: { nome: 'corporativo', limites: { obras: 999, usuarios: 999, storage_gb: 500 } },
  });
  console.log('✓ Planos criados');

  // ─────────────────────────────────────────
  // TIPOS DE OBRA DE SISTEMA (tenantId = 0)
  // ─────────────────────────────────────────

  const tiposSistema = [
    {
      slug: 'residencial_vertical',
      nome: 'Residencial Vertical',
      descricao: 'Edifícios de apartamentos com múltiplas torres e pavimentos',
      totalNiveis: 4,
      niveis: [
        { numero: 1, labelSingular: 'Torre', labelPlural: 'Torres', geracaoEmMassa: true, prefixoPadrao: 'T' },
        { numero: 2, labelSingular: 'Pavimento', labelPlural: 'Pavimentos', geracaoEmMassa: true, prefixoPadrao: 'Pav' },
        { numero: 3, labelSingular: 'Apartamento', labelPlural: 'Apartamentos', geracaoEmMassa: true, prefixoPadrao: 'AP' },
        { numero: 4, labelSingular: 'Cômodo', labelPlural: 'Cômodos', geracaoEmMassa: false, prefixoPadrao: null },
      ],
    },
    {
      slug: 'residencial_horizontal',
      nome: 'Residencial Horizontal',
      descricao: 'Condomínios horizontais, casas em loteamento',
      totalNiveis: 3,
      niveis: [
        { numero: 1, labelSingular: 'Quadra', labelPlural: 'Quadras', geracaoEmMassa: true, prefixoPadrao: 'Q' },
        { numero: 2, labelSingular: 'Lote', labelPlural: 'Lotes', geracaoEmMassa: true, prefixoPadrao: 'Lt' },
        { numero: 3, labelSingular: 'Cômodo', labelPlural: 'Cômodos', geracaoEmMassa: false, prefixoPadrao: null },
      ],
    },
    {
      slug: 'comercial',
      nome: 'Comercial / Corporativo',
      descricao: 'Edifícios comerciais, escritórios, centros empresariais',
      totalNiveis: 3,
      niveis: [
        { numero: 1, labelSingular: 'Pavimento', labelPlural: 'Pavimentos', geracaoEmMassa: true, prefixoPadrao: 'Andar' },
        { numero: 2, labelSingular: 'Sala', labelPlural: 'Salas', geracaoEmMassa: true, prefixoPadrao: 'SL' },
        { numero: 3, labelSingular: 'Ambiente', labelPlural: 'Ambientes', geracaoEmMassa: false, prefixoPadrao: null },
      ],
    },
    {
      slug: 'galpao',
      nome: 'Galpão Industrial',
      descricao: 'Galpões, armazéns, centros de distribuição',
      totalNiveis: 3,
      niveis: [
        { numero: 1, labelSingular: 'Módulo', labelPlural: 'Módulos', geracaoEmMassa: true, prefixoPadrao: 'MOD' },
        { numero: 2, labelSingular: 'Área', labelPlural: 'Áreas', geracaoEmMassa: false, prefixoPadrao: null },
        { numero: 3, labelSingular: 'Ponto', labelPlural: 'Pontos', geracaoEmMassa: false, prefixoPadrao: null },
      ],
    },
    {
      slug: 'hospitalar',
      nome: 'Hospitalar / Saúde',
      descricao: 'Hospitais, clínicas, UPAs',
      totalNiveis: 5,
      niveis: [
        { numero: 1, labelSingular: 'Bloco', labelPlural: 'Blocos', geracaoEmMassa: true, prefixoPadrao: 'BL' },
        { numero: 2, labelSingular: 'Pavimento', labelPlural: 'Pavimentos', geracaoEmMassa: true, prefixoPadrao: 'Pav' },
        { numero: 3, labelSingular: 'Ala', labelPlural: 'Alas', geracaoEmMassa: false, prefixoPadrao: null },
        { numero: 4, labelSingular: 'Quarto', labelPlural: 'Quartos', geracaoEmMassa: true, prefixoPadrao: 'QT' },
        { numero: 5, labelSingular: 'Ambiente', labelPlural: 'Ambientes', geracaoEmMassa: false, prefixoPadrao: null },
      ],
    },
    {
      slug: 'rodovia',
      nome: 'Rodovia / Infraestrutura',
      descricao: 'Rodovias, viadutos, pontes, obras de infraestrutura linear',
      totalNiveis: 3,
      niveis: [
        { numero: 1, labelSingular: 'Lote', labelPlural: 'Lotes', geracaoEmMassa: true, prefixoPadrao: 'LT' },
        { numero: 2, labelSingular: 'Segmento', labelPlural: 'Segmentos', geracaoEmMassa: false, prefixoPadrao: null },
        { numero: 3, labelSingular: 'Ponto de Controle', labelPlural: 'Pontos de Controle', geracaoEmMassa: false, prefixoPadrao: null },
      ],
    },
  ];

  for (const tipo of tiposSistema) {
    const existente = await prisma.obraTipo.findUnique({
      where: { tenantId_slug: { tenantId: 0, slug: tipo.slug } },
    });

    if (!existente) {
      await prisma.obraTipo.create({
        data: {
          tenantId: 0,
          nome: tipo.nome,
          slug: tipo.slug,
          descricao: tipo.descricao,
          totalNiveis: tipo.totalNiveis,
          niveis: {
            create: tipo.niveis,
          },
        },
      });
      console.log(`  ✓ Tipo criado: ${tipo.nome}`);
    } else {
      console.log(`  ↳ Já existe: ${tipo.nome}`);
    }
  }

  console.log('✓ Seed concluído');
}

main().catch(console.error).finally(() => prisma.$disconnect());
