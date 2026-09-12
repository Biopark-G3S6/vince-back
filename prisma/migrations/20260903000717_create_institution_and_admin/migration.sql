-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "institution";

-- CreateTable
CREATE TABLE "institution"."institution" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "cnpj" TEXT,
    "website" TEXT,
    "contact_email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution"."institution_admin" (
    "institution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "institution_admin_pkey" PRIMARY KEY ("institution_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_code_key" ON "institution"."institution"("code");

-- CreateIndex
CREATE UNIQUE INDEX "institution_cnpj_key" ON "institution"."institution"("cnpj");

-- CreateIndex
CREATE INDEX "institution_name_idx" ON "institution"."institution"("name");

-- CreateIndex
CREATE INDEX "institution_admin_user_id_idx" ON "institution"."institution_admin"("user_id");

-- AddForeignKey
ALTER TABLE "institution"."institution_admin" ADD CONSTRAINT "institution_admin_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"."institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
