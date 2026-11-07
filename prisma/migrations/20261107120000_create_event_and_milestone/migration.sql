CREATE SCHEMA IF NOT EXISTS "event";

CREATE TABLE "event"."event" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "course_id" UUID,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "research_problem" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "max_teams" INTEGER NOT NULL,
    "max_team_size" INTEGER NOT NULL,
    "teams_in_use" INTEGER NOT NULL DEFAULT 0,
    "largest_team_size" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_scope_type_check"
      CHECK ("scope_type" IN ('INSTITUTION', 'COURSE', 'COHORT')),
    CONSTRAINT "event_course_ancestry_check"
      CHECK (("scope_type" = 'INSTITUTION') = ("course_id" IS NULL)),
    CONSTRAINT "event_status_check"
      CHECK ("status" IN ('ACTIVE', 'CANCELLED')),
    CONSTRAINT "event_limits_positive_check"
      CHECK ("max_teams" > 0 AND "max_team_size" > 0),
    CONSTRAINT "event_usage_nonnegative_check"
      CHECK ("teams_in_use" >= 0 AND "largest_team_size" >= 0)
);

CREATE INDEX "event_scope_type_scope_id_status_idx"
ON "event"."event"("scope_type", "scope_id", "status");

CREATE INDEX "event_institution_id_status_idx"
ON "event"."event"("institution_id", "status");

CREATE INDEX "event_course_id_status_idx"
ON "event"."event"("course_id", "status");

CREATE INDEX "event_owner_id_created_at_idx"
ON "event"."event"("owner_id", "created_at");

CREATE TABLE "event"."milestone" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "milestone_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "event"."event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "milestone_order_positive_check" CHECK ("order" > 0)
);

CREATE UNIQUE INDEX "milestone_event_id_order_key"
ON "event"."milestone"("event_id", "order");

CREATE INDEX "milestone_event_id_due_at_idx"
ON "event"."milestone"("event_id", "due_at");

CREATE TABLE "event"."event_advisor" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_advisor_pkey" PRIMARY KEY ("event_id", "user_id"),
    CONSTRAINT "event_advisor_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "event"."event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "event_advisor_user_id_event_id_idx"
ON "event"."event_advisor"("user_id", "event_id");

CREATE TABLE "event"."event_advisor_audit" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_advisor_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_advisor_audit_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "event"."event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "event_advisor_audit_operation_check"
      CHECK ("operation" IN ('ASSIGNED', 'REVOKED'))
);

CREATE INDEX "event_advisor_audit_event_id_created_at_idx"
ON "event"."event_advisor_audit"("event_id", "created_at");

CREATE INDEX "event_advisor_audit_user_id_created_at_idx"
ON "event"."event_advisor_audit"("user_id", "created_at");

CREATE TABLE "event"."processed_event" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_processed_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_processed_event_processed_at_idx"
ON "event"."processed_event"("processed_at");

CREATE TABLE "event"."outbox" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_outbox_published_at_created_at_idx"
ON "event"."outbox"("published_at", "created_at");
