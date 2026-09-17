-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "course";

-- CreateTable
CREATE TABLE "course"."course" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course"."course_coordinator" (
    "course_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_coordinator_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "course"."course_coordinator_audit" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_coordinator_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_institution_id_name_idx" ON "course"."course"("institution_id", "name");

-- CreateIndex
CREATE INDEX "course_coordinator_user_id_idx" ON "course"."course_coordinator"("user_id");

-- CreateIndex
CREATE INDEX "course_coordinator_audit_course_id_created_at_idx" ON "course"."course_coordinator_audit"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "course_coordinator_audit_user_id_created_at_idx" ON "course"."course_coordinator_audit"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "course"."course_coordinator" ADD CONSTRAINT "course_coordinator_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
