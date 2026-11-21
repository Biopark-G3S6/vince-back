-- Título do artigo e parecer da nota (`article-title-and-feedback`). Escrita à mão:
-- `prisma migrate dev` arrastaria o schema de observabilidade.

-- AlterTable
ALTER TABLE "article"."article" ADD COLUMN "title" TEXT;

-- AlterTable
ALTER TABLE "article"."article_assessment_history" ADD COLUMN "feedback" TEXT;
