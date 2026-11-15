-- Cidade e UF da instituição (`institution-location`). Escrita à mão: `prisma migrate dev`
-- arrastaria o schema de observabilidade.

-- AlterTable
ALTER TABLE "institution"."institution" ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT;
