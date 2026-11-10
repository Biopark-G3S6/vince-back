CREATE SCHEMA IF NOT EXISTS "discussion";
CREATE SCHEMA IF NOT EXISTS "notification";
CREATE SCHEMA IF NOT EXISTS "assistance";
CREATE SCHEMA IF NOT EXISTS "progress";

CREATE TABLE "discussion"."discussion_message" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "root_id" uuid,
  "remark_id" uuid,
  "body" text,
  "deleted_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "discussion_message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discussion"."discussion_outbox" (
  "id" uuid NOT NULL,
  "type" text NOT NULL,
  "contract_version" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "correlation_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" timestamptz(3),
  "attempts" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "discussion_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification"."notification" (
  "id" uuid NOT NULL,
  "recipient_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "type" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "read_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification"."notification_email_preference" (
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "notification_email_preference_pkey" PRIMARY KEY ("user_id", "type")
);

CREATE TABLE "notification"."email_delivery" (
  "id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "status" text NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamptz(3),
  "last_error_code" text,
  "sent_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "email_delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification"."notification_outbox" (
  "id" uuid NOT NULL,
  "type" text NOT NULL,
  "contract_version" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "correlation_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" timestamptz(3),
  "attempts" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistance"."institution_ai_consent" (
  "id" uuid NOT NULL,
  "institution_id" uuid NOT NULL,
  "declaration_version" text NOT NULL,
  "declaration_snapshot" text NOT NULL,
  "provider_name" text NOT NULL,
  "processing_purpose" text NOT NULL,
  "consented_by" uuid NOT NULL,
  "consented_at" timestamptz(3) NOT NULL,
  "revoked_by" uuid,
  "revoked_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "institution_ai_consent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistance"."article_analysis" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "requested_by" uuid NOT NULL,
  "status" text NOT NULL,
  "result" jsonb,
  "error_code" text,
  "correlation_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_analysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistance"."processed_event" (
  "event_id" uuid NOT NULL,
  "processed_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_event_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "assistance"."assistance_outbox" (
  "id" uuid NOT NULL,
  "type" text NOT NULL,
  "contract_version" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "correlation_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" timestamptz(3),
  "attempts" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "assistance_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress"."risk_signal" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "course_id" uuid,
  "event_id" uuid NOT NULL,
  "condition" text NOT NULL,
  "activation_event_id" uuid NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "activated_at" timestamptz(3) NOT NULL,
  "last_observed_at" timestamptz(3) NOT NULL,
  "cleared_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "risk_signal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress"."progress_report" (
  "id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "period_start" timestamptz(3) NOT NULL,
  "period_end" timestamptz(3) NOT NULL,
  "created_by" uuid NOT NULL,
  "status" text NOT NULL,
  "data" jsonb,
  "error_code" text,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "progress_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress"."processed_event" (
  "event_id" uuid NOT NULL,
  "processed_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_progress_event_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "progress"."progress_outbox" (
  "id" uuid NOT NULL,
  "type" text NOT NULL,
  "contract_version" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "correlation_id" uuid,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" timestamptz(3),
  "attempts" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "progress_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_assessment_history" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "member_id" uuid,
  "score" double precision NOT NULL,
  "evaluated_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_assessment_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."external_publication" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "venue_name" text NOT NULL,
  "kind" text NOT NULL,
  "publication_date" date NOT NULL,
  "url" text NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "external_publication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_event_id_recipient_id_key" ON "notification"."notification"("event_id", "recipient_id");
CREATE UNIQUE INDEX "email_delivery_notification_id_key" ON "notification"."email_delivery"("notification_id");
CREATE UNIQUE INDEX "risk_signal_team_id_condition_key" ON "progress"."risk_signal"("team_id", "condition");
CREATE UNIQUE INDEX "institution_ai_consent_one_active_per_institution_key" ON "assistance"."institution_ai_consent"("institution_id") WHERE "revoked_at" IS NULL;

CREATE INDEX "discussion_message_article_id_created_at_id_idx" ON "discussion"."discussion_message"("article_id", "created_at", "id");
CREATE INDEX "discussion_message_team_id_article_id_idx" ON "discussion"."discussion_message"("team_id", "article_id");
CREATE INDEX "discussion_message_root_id_created_at_id_idx" ON "discussion"."discussion_message"("root_id", "created_at", "id");
CREATE INDEX "discussion_message_remark_id_idx" ON "discussion"."discussion_message"("remark_id");
CREATE INDEX "discussion_outbox_published_at_updated_at_created_at_idx" ON "discussion"."discussion_outbox"("published_at", "updated_at", "created_at");
CREATE INDEX "notification_recipient_id_read_at_created_at_idx" ON "notification"."notification"("recipient_id", "read_at", "created_at");
CREATE INDEX "notification_target_type_target_id_idx" ON "notification"."notification"("target_type", "target_id");
CREATE INDEX "email_delivery_status_next_attempt_at_idx" ON "notification"."email_delivery"("status", "next_attempt_at");
CREATE INDEX "notification_outbox_published_at_created_at_idx" ON "notification"."notification_outbox"("published_at", "created_at");
CREATE INDEX "institution_ai_consent_institution_id_consented_at_idx" ON "assistance"."institution_ai_consent"("institution_id", "consented_at");
CREATE INDEX "article_analysis_article_id_kind_created_at_idx" ON "assistance"."article_analysis"("article_id", "kind", "created_at");
CREATE INDEX "article_analysis_status_created_at_idx" ON "assistance"."article_analysis"("status", "created_at");
CREATE INDEX "assistance_outbox_published_at_created_at_idx" ON "assistance"."assistance_outbox"("published_at", "created_at");
CREATE INDEX "risk_signal_course_id_active_activated_at_idx" ON "progress"."risk_signal"("course_id", "active", "activated_at");
CREATE INDEX "risk_signal_article_id_active_idx" ON "progress"."risk_signal"("article_id", "active");
CREATE INDEX "progress_report_course_id_period_start_period_end_created_at_idx" ON "progress"."progress_report"("course_id", "period_start", "period_end", "created_at");
CREATE INDEX "progress_outbox_published_at_created_at_idx" ON "progress"."progress_outbox"("published_at", "created_at");
CREATE INDEX "article_assessment_history_article_id_member_id_created_at_idx" ON "article"."article_assessment_history"("article_id", "member_id", "created_at");
CREATE INDEX "external_publication_article_id_publication_date_idx" ON "article"."external_publication"("article_id", "publication_date");

ALTER TABLE "discussion"."discussion_message"
  ADD CONSTRAINT "discussion_message_root_id_fkey"
  FOREIGN KEY ("root_id") REFERENCES "discussion"."discussion_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification"."email_delivery"
  ADD CONSTRAINT "email_delivery_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notification"."notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_assessment_history"
  ADD CONSTRAINT "article_assessment_history_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."external_publication"
  ADD CONSTRAINT "external_publication_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
