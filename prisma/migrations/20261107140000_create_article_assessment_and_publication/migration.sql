CREATE SCHEMA IF NOT EXISTS "article";

CREATE TABLE "article"."article" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "article_status_check"
      CHECK ("status" IN ('STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'FINISHED'))
);

-- Um artigo por equipe (RE-05): é esta unicidade que torna o consumo de `TeamCreated`
-- idempotente, sem precisar de uma segunda tabela de controle.
CREATE UNIQUE INDEX "article_team_id_key" ON "article"."article"("team_id");

CREATE INDEX "article_event_id_status_idx" ON "article"."article"("event_id", "status");

CREATE INDEX "article_institution_id_status_idx"
ON "article"."article"("institution_id", "status");

CREATE TABLE "article"."article_grade" (
    "article_id" UUID NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_grade_pkey" PRIMARY KEY ("article_id"),
    CONSTRAINT "article_grade_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_grade_value_range_check" CHECK ("value" >= 0 AND "value" <= 10)
);

CREATE TABLE "article"."member_grade" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "member_grade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_grade_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_grade_value_range_check" CHECK ("value" >= 0 AND "value" <= 10)
);

CREATE UNIQUE INDEX "member_grade_article_id_user_id_key"
ON "article"."member_grade"("article_id", "user_id");

CREATE TABLE "article"."article_grade_history" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "author_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_grade_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "article_grade_history_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "article_grade_history_value_range_check" CHECK ("value" >= 0 AND "value" <= 10)
);

CREATE INDEX "article_grade_history_article_id_recorded_at_idx"
ON "article"."article_grade_history"("article_id", "recorded_at");

CREATE TABLE "article"."member_grade_history" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "author_id" UUID NOT NULL,
    "member_active" BOOLEAN NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "member_grade_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_grade_history_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "member_grade_history_value_range_check" CHECK ("value" >= 0 AND "value" <= 10)
);

CREATE INDEX "member_grade_history_article_id_user_id_recorded_at_idx"
ON "article"."member_grade_history"("article_id", "user_id", "recorded_at");

CREATE TABLE "article"."publication" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "venue" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "url" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "publication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "publication_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publication_kind_check" CHECK ("kind" IN ('EVENT', 'JOURNAL'))
);

CREATE INDEX "publication_article_id_published_at_idx"
ON "article"."publication"("article_id", "published_at");

CREATE TABLE "article"."processed_event" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_processed_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "article_processed_event_processed_at_idx"
ON "article"."processed_event"("processed_at");

CREATE TABLE "article"."outbox" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "article_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "article_outbox_published_at_created_at_idx"
ON "article"."outbox"("published_at", "created_at");
