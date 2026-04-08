/*
  Warnings:

  - You are about to drop the column `nivel1Nome` on the `Obra` table. All the data in the column will be lost.
  - You are about to drop the column `nivel2Nome` on the `Obra` table. All the data in the column will be lost.
  - You are about to drop the column `nivel3Nome` on the `Obra` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `Obra` table. All the data in the column will be lost.
  - The `modoQualidade` column on the `Obra` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `atualizadoEm` to the `Obra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `obraTipoId` to the `Obra` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModoQualidade" AS ENUM ('SIMPLES', 'PBQPH');

-- CreateEnum
CREATE TYPE "StatusObra" AS ENUM ('PLANEJAMENTO', 'EM_EXECUCAO', 'PARALISADA', 'CONCLUIDA', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "StatusLocal" AS ENUM ('PENDENTE', 'EM_EXECUCAO', 'CONCLUIDO', 'ENTREGUE', 'SUSPENSO');

-- AlterTable
ALTER TABLE "Obra" DROP COLUMN "nivel1Nome",
DROP COLUMN "nivel2Nome",
DROP COLUMN "nivel3Nome",
DROP COLUMN "tipo",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "dadosExtras" JSONB,
ADD COLUMN     "dataFimPrevista" TIMESTAMP(3),
ADD COLUMN     "dataFimReal" TIMESTAMP(3),
ADD COLUMN     "dataInicioPrevista" TIMESTAMP(3),
ADD COLUMN     "dataInicioReal" TIMESTAMP(3),
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "obraTipoId" INTEGER NOT NULL,
ADD COLUMN     "status" "StatusObra" NOT NULL DEFAULT 'PLANEJAMENTO',
DROP COLUMN "modoQualidade",
ADD COLUMN     "modoQualidade" "ModoQualidade" NOT NULL DEFAULT 'SIMPLES';

-- CreateTable
CREATE TABLE "ObraTipo" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT,
    "totalNiveis" INTEGER NOT NULL DEFAULT 3,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "ObraTipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraTipoNivel" (
    "id" SERIAL NOT NULL,
    "obraTipoId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "labelSingular" TEXT NOT NULL,
    "labelPlural" TEXT NOT NULL,
    "geracaoEmMassa" BOOLEAN NOT NULL DEFAULT false,
    "prefixoPadrao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraTipoNivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraTipoCampo" (
    "id" SERIAL NOT NULL,
    "obraTipoId" INTEGER NOT NULL,
    "nivel" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "opcoes" JSONB,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraTipoCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraLocal" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "obraId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "nivel" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "status" "StatusLocal" NOT NULL DEFAULT 'PENDENTE',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "plantaBaixaId" INTEGER,
    "dataInicioPrevista" TIMESTAMP(3),
    "dataFimPrevista" TIMESTAMP(3),
    "dadosExtras" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "ObraLocal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraNivelConfig" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "nivel" INTEGER NOT NULL,
    "labelSingular" TEXT NOT NULL,
    "labelPlural" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraNivelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraQualityConfig" (
    "id" SERIAL NOT NULL,
    "obraId" INTEGER NOT NULL,
    "modoQualidade" "ModoQualidade" NOT NULL DEFAULT 'SIMPLES',
    "slaAprovacaoHoras" INTEGER NOT NULL DEFAULT 48,
    "exigeAssinaturaFVS" BOOLEAN NOT NULL DEFAULT false,
    "exigeAssinaturaDiario" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObraQualityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObraTipo_tenantId_idx" ON "ObraTipo"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ObraTipo_tenantId_slug_key" ON "ObraTipo"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ObraTipoNivel_obraTipoId_numero_key" ON "ObraTipoNivel"("obraTipoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ObraTipoCampo_obraTipoId_nivel_chave_key" ON "ObraTipoCampo"("obraTipoId", "nivel", "chave");

-- CreateIndex
CREATE INDEX "ObraLocal_tenantId_idx" ON "ObraLocal"("tenantId");

-- CreateIndex
CREATE INDEX "ObraLocal_tenantId_obraId_idx" ON "ObraLocal"("tenantId", "obraId");

-- CreateIndex
CREATE INDEX "ObraLocal_tenantId_obraId_nivel_idx" ON "ObraLocal"("tenantId", "obraId", "nivel");

-- CreateIndex
CREATE INDEX "ObraLocal_parentId_idx" ON "ObraLocal"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ObraNivelConfig_obraId_nivel_key" ON "ObraNivelConfig"("obraId", "nivel");

-- CreateIndex
CREATE UNIQUE INDEX "ObraQualityConfig_obraId_key" ON "ObraQualityConfig"("obraId");

-- CreateIndex
CREATE INDEX "Obra_tenantId_deletadoEm_idx" ON "Obra"("tenantId", "deletadoEm");

-- CreateIndex
CREATE INDEX "Obra_tenantId_status_idx" ON "Obra"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ObraTipoNivel" ADD CONSTRAINT "ObraTipoNivel_obraTipoId_fkey" FOREIGN KEY ("obraTipoId") REFERENCES "ObraTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraTipoCampo" ADD CONSTRAINT "ObraTipoCampo_obraTipoId_fkey" FOREIGN KEY ("obraTipoId") REFERENCES "ObraTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_obraTipoId_fkey" FOREIGN KEY ("obraTipoId") REFERENCES "ObraTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraLocal" ADD CONSTRAINT "ObraLocal_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraLocal" ADD CONSTRAINT "ObraLocal_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ObraLocal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraNivelConfig" ADD CONSTRAINT "ObraNivelConfig_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraQualityConfig" ADD CONSTRAINT "ObraQualityConfig_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
