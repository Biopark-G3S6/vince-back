-- Concessão direta de permissão entre contas (RF-ACS-006 a RF-ACS-008, ADR-0014 §15–§21).
-- Escrita à mão: `prisma migrate dev` arrastaria o schema de observabilidade.

-- CreateTable
CREATE TABLE "access"."permission_grant" (
    "id" UUID NOT NULL,
    "granter_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permission_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_grant_beneficiary_id_idx" ON "access"."permission_grant"("beneficiary_id");

-- CreateIndex
CREATE INDEX "permission_grant_institution_id_created_at_idx" ON "access"."permission_grant"("institution_id", "created_at");

-- CreateIndex
CREATE INDEX "permission_grant_permission_id_idx" ON "access"."permission_grant"("permission_id");

-- AddForeignKey
ALTER TABLE "access"."permission_grant" ADD CONSTRAINT "permission_grant_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "access"."permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
