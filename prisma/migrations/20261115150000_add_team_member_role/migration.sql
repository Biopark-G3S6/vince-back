-- Papel do integrante na equipe (`team-member-role`). Escrita à mão: `prisma migrate dev`
-- arrastaria o schema de observabilidade. Quem já integra uma equipe passa a coautor.

-- AlterTable
ALTER TABLE "team"."team_member" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'COAUTHOR';
