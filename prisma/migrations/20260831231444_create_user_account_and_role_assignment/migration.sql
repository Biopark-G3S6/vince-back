-- CreateTable
CREATE TABLE "access"."user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expertise_area" TEXT,
    "preferred_language" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "institution_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access"."user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "access"."role_assignment_audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "subject_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "role_code" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_assignment_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "access"."user"("email");

-- CreateIndex
CREATE INDEX "user_institution_id_idx" ON "access"."user"("institution_id");

-- CreateIndex
CREATE INDEX "user_role_role_id_idx" ON "access"."user_role"("role_id");

-- CreateIndex
CREATE INDEX "role_assignment_audit_subject_id_created_at_idx" ON "access"."role_assignment_audit"("subject_id", "created_at");

-- AddForeignKey
ALTER TABLE "access"."user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "access"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access"."user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access"."role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
