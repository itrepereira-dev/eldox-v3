/**
 * Seed — Residencial Celina Bezerra
 *
 * Estrutura:
 *   4 Condomínios
 *   └── 18 Torres por condomínio
 *       └── 4 Pavimentos por torre
 *           ├── Hall
 *           └── Aptos 11-14 / 21-24 / 31-34 / 41-44
 *   └── Salão de Festas (1 por condomínio)
 *   └── Quiosques 01-10 (por condomínio)
 *
 * Totais por condomínio: 18 torres · 72 pavimentos · 288 aptos · 72 halls · 1 salão · 10 quiosques
 * Total geral: 1848 ObraLocais
 *
 * Uso:
 *   TENANT_ID=1 npx ts-node prisma/seed-obra-celina-bezerra.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TENANT_ID  = parseInt(process.env.TENANT_ID  ?? '1', 10);
const OBRA_NOME  = 'Residencial Celina Bezerra';
const OBRA_COD   = 'RCB';          // prefixo curto para os códigos de local
const OBRA_CITY  = 'Fortaleza';
const OBRA_STATE = 'CE';
// ─────────────────────────────────────────────────────────────────────────────

function pad(n: number, size = 2) {
  return String(n).padStart(size, '0');
}

const PAV_LABELS = [
  '1º Pavimento',
  '2º Pavimento',
  '3º Pavimento',
  '4º Pavimento',
];

async function main() {
  console.log(`\n🏗  Gerando obra: ${OBRA_NOME} (tenant ${TENANT_ID})\n`);

  // ── 1. Busca ObraTipo sistema ────────────────────────────────────────────
  const obraTipo = await prisma.obraTipo.findUnique({
    where: { tenantId_slug: { tenantId: 0, slug: 'residencial_vertical' } },
  });
  if (!obraTipo) {
    throw new Error(
      'ObraTipo "residencial_vertical" não encontrado. Execute seed.ts primeiro.',
    );
  }

  // ── 2. Cria a Obra ───────────────────────────────────────────────────────
  const obra = await prisma.obra.create({
    data: {
      tenantId:      TENANT_ID,
      obraTipoId:    obraTipo.id,
      nome:          OBRA_NOME,
      codigo:        'OBR-2026-001',
      status:        'PLANEJAMENTO',
      cidade:        OBRA_CITY,
      estado:        OBRA_STATE,
    },
  });
  console.log(`✓ Obra criada — ID ${obra.id}: ${obra.nome}`);

  // ── 3. Override de labels (Condomínio / Torre / Pavimento / Unidade) ─────
  await prisma.obraNivelConfig.createMany({
    data: [
      { obraId: obra.id, nivel: 1, labelSingular: 'Condomínio',  labelPlural: 'Condomínios'  },
      { obraId: obra.id, nivel: 2, labelSingular: 'Torre',        labelPlural: 'Torres'        },
      { obraId: obra.id, nivel: 3, labelSingular: 'Pavimento',    labelPlural: 'Pavimentos'    },
      { obraId: obra.id, nivel: 4, labelSingular: 'Unidade',      labelPlural: 'Unidades'      },
    ],
  });
  console.log('✓ Labels de nível configuradas');

  // ── 4. Nível 1 — Condomínios ─────────────────────────────────────────────
  const condominios: { id: number; nome: string; cod: string }[] = [];

  for (let c = 1; c <= 4; c++) {
    const cod  = `${OBRA_COD}-C${pad(c)}`;
    const nome = `Condomínio ${c}`;
    const rec  = await prisma.obraLocal.create({
      data: {
        tenantId:     TENANT_ID,
        obraId:       obra.id,
        nivel:        1,
        nome,
        codigo:       cod,
        nomeCompleto: nome,
        ordem:        c,
      },
    });
    condominios.push({ id: rec.id, nome, cod });
  }
  console.log(`✓ ${condominios.length} condomínios criados`);

  // ── 5. Nível 2 — Torres + Salão de Festas + Quiosques ───────────────────
  const torres: { id: number; nomeCompleto: string; cod: string }[] = [];

  for (const condo of condominios) {
    // 18 torres (individuais para capturar IDs)
    for (let t = 1; t <= 18; t++) {
      const cod          = `${condo.cod}-T${pad(t)}`;
      const nomeCompleto = `${condo.nome} > Torre ${t}`;
      const rec          = await prisma.obraLocal.create({
        data: {
          tenantId:     TENANT_ID,
          obraId:       obra.id,
          parentId:     condo.id,
          nivel:        2,
          nome:         `Torre ${t}`,
          codigo:       cod,
          nomeCompleto,
          ordem:        t,
        },
      });
      torres.push({ id: rec.id, nomeCompleto, cod });
    }

    // Salão de Festas
    await prisma.obraLocal.create({
      data: {
        tenantId:     TENANT_ID,
        obraId:       obra.id,
        parentId:     condo.id,
        nivel:        2,
        nome:         'Salão de Festas',
        codigo:       `${condo.cod}-SALAO`,
        nomeCompleto: `${condo.nome} > Salão de Festas`,
        ordem:        19,
      },
    });

    // 10 Quiosques (em lote — são folhas, IDs não necessários)
    await prisma.obraLocal.createMany({
      data: Array.from({ length: 10 }, (_, i) => {
        const num = pad(i + 1);
        return {
          tenantId:     TENANT_ID,
          obraId:       obra.id,
          parentId:     condo.id,
          nivel:        2,
          nome:         `Quiosque ${num}`,
          codigo:       `${condo.cod}-Q${num}`,
          nomeCompleto: `${condo.nome} > Quiosque ${num}`,
          ordem:        20 + i,
        };
      }),
    });
  }
  console.log(`✓ ${torres.length} torres criadas  (+ 4 salões + 40 quiosques)`);

  // ── 6. Nível 3 — Pavimentos ──────────────────────────────────────────────
  const pavimentos: {
    id: number;
    nomeCompleto: string;
    cod: string;
    pavNum: number;
  }[] = [];

  for (const torre of torres) {
    for (let p = 1; p <= 4; p++) {
      const cod          = `${torre.cod}-P${pad(p)}`;
      const nomeCompleto = `${torre.nomeCompleto} > ${PAV_LABELS[p - 1]}`;
      const rec          = await prisma.obraLocal.create({
        data: {
          tenantId:     TENANT_ID,
          obraId:       obra.id,
          parentId:     torre.id,
          nivel:        3,
          nome:         PAV_LABELS[p - 1],
          codigo:       cod,
          nomeCompleto,
          ordem:        p,
        },
      });
      pavimentos.push({ id: rec.id, nomeCompleto, cod, pavNum: p });
    }
  }
  console.log(`✓ ${pavimentos.length} pavimentos criados`);

  // ── 7. Nível 4 — Unidades (Hall + Aptos) ────────────────────────────────
  //
  // Numeração: piso p → aptos (p*10+1) a (p*10+4)
  //   Piso 1 → 11, 12, 13, 14
  //   Piso 2 → 21, 22, 23, 24
  //   Piso 3 → 31, 32, 33, 34
  //   Piso 4 → 41, 42, 43, 44
  //
  const unidades = pavimentos.flatMap(pav => {
    const p       = pav.pavNum;
    const baseNum = p * 10;

    const hall = {
      tenantId:     TENANT_ID,
      obraId:       obra.id,
      parentId:     pav.id,
      nivel:        4,
      nome:         'Hall',
      codigo:       `${pav.cod}-HALL`,
      nomeCompleto: `${pav.nomeCompleto} > Hall`,
      ordem:        0,
    };

    const aptos = Array.from({ length: 4 }, (_, i) => {
      const num = baseNum + 10 + (i + 1); // 11..14, 21..24, 31..34, 41..44
      return {
        tenantId:     TENANT_ID,
        obraId:       obra.id,
        parentId:     pav.id,
        nivel:        4,
        nome:         `Apto ${num}`,
        codigo:       `${pav.cod}-A${num}`,
        nomeCompleto: `${pav.nomeCompleto} > Apto ${num}`,
        ordem:        i + 1,
      };
    });

    return [hall, ...aptos];
  });

  // Inserção em lotes de 500 para evitar sobrecarga
  const BATCH = 500;
  for (let i = 0; i < unidades.length; i += BATCH) {
    await prisma.obraLocal.createMany({ data: unidades.slice(i, i + BATCH) });
    process.stdout.write(`  inserindo unidades… ${Math.min(i + BATCH, unidades.length)}/${unidades.length}\r`);
  }
  console.log(`\n✓ ${unidades.length} unidades criadas (aptos + halls)`);

  // ── Resumo ───────────────────────────────────────────────────────────────
  const total =
    condominios.length +
    torres.length +
    4 /* salões */ +
    40 /* quiosques */ +
    pavimentos.length +
    unidades.length;

  console.log(`
┌──────────────────────────────────────────────┐
│  ${OBRA_NOME.padEnd(44)}│
├──────────────────────────────────────────────┤
│  Condomínios   :  ${String(condominios.length).padStart(4)}                          │
│  Torres        :  ${String(torres.length).padStart(4)}  (${torres.length / condominios.length}/cond)              │
│  Salões        :  ${String(4).padStart(4)}  (1/cond)                    │
│  Quiosques     :  ${String(40).padStart(4)}  (10/cond)                   │
│  Pavimentos    :  ${String(pavimentos.length).padStart(4)}  (4/torre)                  │
│  Halls         :  ${String(pavimentos.length).padStart(4)}  (1/pav)                   │
│  Apartamentos  :  ${String(pavimentos.length * 4).padStart(4)}  (4/pav · seq 11-44)   │
├──────────────────────────────────────────────┤
│  Total locais  :  ${String(total).padStart(4)}                          │
└──────────────────────────────────────────────┘
`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
