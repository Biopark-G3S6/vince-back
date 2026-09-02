-- CreateTable
CREATE TABLE "access"."password_credential" (
    "user_id" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "password_credential_pkey" PRIMARY KEY ("user_id")
);
-- CreateTable
CREATE TABLE "access"."invitation" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "invitation_token_hash_key" ON "access"."invitation"("token_hash");
-- CreateIndex
CREATE INDEX "invitation_user_id_purpose_idx" ON "access"."invitation"("user_id", "purpose");
-- AddForeignKey
ALTER TABLE "access"."password_credential" ADD CONSTRAINT "password_credential_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "access"."invitation" ADD CONSTRAINT "invitation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
