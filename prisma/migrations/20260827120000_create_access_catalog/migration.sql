-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "access";

-- CreateTable
CREATE TABLE "access"."permission" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."role_permission" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "access"."permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "access"."role"("code");

-- CreateIndex
CREATE INDEX "role_permission_permission_id_idx" ON "access"."role_permission"("permission_id");

-- AddForeignKey
ALTER TABLE "access"."role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access"."role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "access"."permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

