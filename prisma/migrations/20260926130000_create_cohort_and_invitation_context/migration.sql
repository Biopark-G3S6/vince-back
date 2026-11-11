CREATE SCHEMA IF NOT EXISTS "cohort";

ALTER TABLE "access"."invitation"
ADD COLUMN "scope_type" TEXT,
ADD COLUMN "scope_id" UUID;

CREATE INDEX "invitation_scope_type_scope_id_idx"
ON "access"."invitation"("scope_type", "scope_id");

CREATE TABLE "access"."outbox" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_published_at_created_at_idx"
ON "access"."outbox"("published_at", "created_at");

CREATE TABLE "cohort"."cohort" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "identification" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cohort_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cohort_dates_check" CHECK ("ends_at" >= "starts_at")
);

CREATE UNIQUE INDEX "cohort_course_id_term_identification_key"
ON "cohort"."cohort"("course_id", "term", "identification");

CREATE INDEX "cohort_course_id_active_idx"
ON "cohort"."cohort"("course_id", "active");

CREATE INDEX "cohort_course_id_starts_at_idx"
ON "cohort"."cohort"("course_id", "starts_at");

CREATE TABLE "cohort"."cohort_professor" (
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cohort_professor_pkey" PRIMARY KEY ("cohort_id", "user_id"),
    CONSTRAINT "cohort_professor_cohort_id_fkey"
      FOREIGN KEY ("cohort_id") REFERENCES "cohort"."cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "cohort_professor_user_id_cohort_id_idx"
ON "cohort"."cohort_professor"("user_id", "cohort_id");

CREATE TABLE "cohort"."cohort_professor_audit" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cohort_professor_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cohort_professor_audit_cohort_id_fkey"
      FOREIGN KEY ("cohort_id") REFERENCES "cohort"."cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cohort_professor_audit_operation_check"
      CHECK ("operation" IN ('ASSIGNED', 'REVOKED'))
);

CREATE INDEX "cohort_professor_audit_cohort_id_created_at_idx"
ON "cohort"."cohort_professor_audit"("cohort_id", "created_at");

CREATE INDEX "cohort_professor_audit_user_id_created_at_idx"
ON "cohort"."cohort_professor_audit"("user_id", "created_at");

CREATE TABLE "cohort"."enrollment" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "enrollment_cohort_id_fkey"
      FOREIGN KEY ("cohort_id") REFERENCES "cohort"."cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrollment_status_check"
      CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX "enrollment_active_user_id_key"
ON "cohort"."enrollment"("user_id")
WHERE "status" = 'ACTIVE';

CREATE INDEX "enrollment_cohort_id_status_created_at_idx"
ON "cohort"."enrollment"("cohort_id", "status", "created_at");

CREATE INDEX "enrollment_user_id_status_idx"
ON "cohort"."enrollment"("user_id", "status");

CREATE TABLE "cohort"."cohort_invitation" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "professor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cohort_invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cohort_invitation_invitation_id_key" UNIQUE ("invitation_id"),
    CONSTRAINT "cohort_invitation_cohort_id_fkey"
      FOREIGN KEY ("cohort_id") REFERENCES "cohort"."cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "cohort_invitation_cohort_id_created_at_idx"
ON "cohort"."cohort_invitation"("cohort_id", "created_at");

CREATE INDEX "cohort_invitation_professor_id_created_at_idx"
ON "cohort"."cohort_invitation"("professor_id", "created_at");

CREATE TABLE "cohort"."processed_event" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "processed_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "processed_event_processed_at_idx"
ON "cohort"."processed_event"("processed_at");

CREATE TABLE "cohort"."outbox" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cohort_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cohort_outbox_published_at_created_at_idx"
ON "cohort"."outbox"("published_at", "created_at");
