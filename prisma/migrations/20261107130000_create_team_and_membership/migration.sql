CREATE SCHEMA IF NOT EXISTS "team";

CREATE TABLE "team"."team" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "identification" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_event_id_identification_key"
ON "team"."team"("event_id", "identification");

CREATE INDEX "team_event_id_created_at_idx"
ON "team"."team"("event_id", "created_at");

CREATE TABLE "team"."team_member" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_member_team_id_fkey"
      FOREIGN KEY ("team_id") REFERENCES "team"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "team_member_status_check"
      CHECK ("status" IN ('ACTIVE', 'REMOVED')),
    CONSTRAINT "team_member_left_at_check"
      CHECK (("status" = 'REMOVED') = ("left_at" IS NOT NULL))
);

-- Uma equipe por aluno e por evento, **entre as participações ativas** (ADR-0033 §8).
-- Parcial, e não total: o índice total impediria o reingresso de quem foi removido.
CREATE UNIQUE INDEX "team_member_active_event_id_user_id_key"
ON "team"."team_member"("event_id", "user_id")
WHERE "status" = 'ACTIVE';

CREATE INDEX "team_member_team_id_status_idx"
ON "team"."team_member"("team_id", "status");

CREATE INDEX "team_member_event_id_status_idx"
ON "team"."team_member"("event_id", "status");

CREATE INDEX "team_member_user_id_status_idx"
ON "team"."team_member"("user_id", "status");

CREATE TABLE "team"."team_invitation" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_invitation_team_id_fkey"
      FOREIGN KEY ("team_id") REFERENCES "team"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "team_invitation_status_check"
      CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED'))
);

-- Um convite pendente por aluno e equipe: repetir a emissão não enfileira convites.
CREATE UNIQUE INDEX "team_invitation_pending_team_id_user_id_key"
ON "team"."team_invitation"("team_id", "user_id")
WHERE "status" = 'PENDING';

CREATE INDEX "team_invitation_team_id_created_at_idx"
ON "team"."team_invitation"("team_id", "created_at");

CREATE INDEX "team_invitation_user_id_status_idx"
ON "team"."team_invitation"("user_id", "status");

CREATE TABLE "team"."team_advisor" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_advisor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_advisor_team_id_fkey"
      FOREIGN KEY ("team_id") REFERENCES "team"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_advisor_status_check"
      CHECK ("status" IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT "team_advisor_revoked_at_check"
      CHECK (("status" = 'REVOKED') = ("revoked_at" IS NOT NULL))
);

-- No máximo um responsável ativo por equipe (RF-EQP-005 RN3, ADR-0033 §10).
CREATE UNIQUE INDEX "team_advisor_active_team_id_key"
ON "team"."team_advisor"("team_id")
WHERE "status" = 'ACTIVE';

CREATE INDEX "team_advisor_team_id_status_idx"
ON "team"."team_advisor"("team_id", "status");

CREATE INDEX "team_advisor_user_id_status_idx"
ON "team"."team_advisor"("user_id", "status");

CREATE TABLE "team"."team_advisor_audit" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_advisor_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_advisor_audit_team_id_fkey"
      FOREIGN KEY ("team_id") REFERENCES "team"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "team_advisor_audit_operation_check"
      CHECK ("operation" IN ('ASSIGNED', 'REVOKED'))
);

CREATE INDEX "team_advisor_audit_team_id_created_at_idx"
ON "team"."team_advisor_audit"("team_id", "created_at");

CREATE INDEX "team_advisor_audit_user_id_created_at_idx"
ON "team"."team_advisor_audit"("user_id", "created_at");

CREATE TABLE "team"."processed_event" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_processed_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_processed_event_processed_at_idx"
ON "team"."processed_event"("processed_at");

CREATE TABLE "team"."outbox" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_outbox_published_at_created_at_idx"
ON "team"."outbox"("published_at", "created_at");
