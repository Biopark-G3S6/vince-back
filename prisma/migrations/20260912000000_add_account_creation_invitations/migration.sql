-- AlterTable
ALTER TABLE "access"."invitation"
    ALTER COLUMN "user_id" DROP NOT NULL,
    ADD COLUMN "target_email" TEXT,
    ADD COLUMN "role_code" TEXT,
    ADD COLUMN "institution_id" UUID,
    ADD COLUMN "institution_name" TEXT,
    ADD COLUMN "actor_id" UUID,
    ADD COLUMN "max_uses" INTEGER,
    ADD COLUMN "use_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "revoked_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "access"."invitation_audit" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "actor_id" UUID,
    "account_id" UUID,
    "role_code" TEXT NOT NULL,
    "institution_id" UUID NOT NULL,
    "institution_name" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitation_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invitation_institution_id_purpose_created_at_idx"
    ON "access"."invitation"("institution_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "invitation_audit_invitation_id_created_at_idx"
    ON "access"."invitation_audit"("invitation_id", "created_at");

-- AddCheck
ALTER TABLE "access"."invitation"
    ADD CONSTRAINT "invitation_use_count_nonnegative_check" CHECK ("use_count" >= 0),
    ADD CONSTRAINT "invitation_max_uses_positive_check" CHECK ("max_uses" IS NULL OR "max_uses" > 0);
