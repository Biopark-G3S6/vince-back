-- Nome da equipe copiado no artigo (`article-team-name`). Escrita à mão:
-- `prisma migrate dev` arrastaria o schema de observabilidade.

-- AlterTable
ALTER TABLE "article"."article" ADD COLUMN "team_identification" TEXT;
