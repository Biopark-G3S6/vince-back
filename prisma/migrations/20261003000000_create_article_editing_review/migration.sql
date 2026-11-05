CREATE SCHEMA IF NOT EXISTS "article";

CREATE TABLE "article"."article_template" (
  "id" uuid NOT NULL,
  "institution_id" uuid NOT NULL,
  "course_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "current_version_number" integer NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_template_version" (
  "id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "content" jsonb NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_template_version_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_template_selection" (
  "id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "institution_id" uuid NOT NULL,
  "course_id" uuid,
  "template_id" uuid,
  "template_version_id" uuid,
  "selected_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_template_selection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article" (
  "id" uuid NOT NULL,
  "institution_id" uuid NOT NULL,
  "course_id" uuid,
  "event_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "advisor_id" uuid,
  "member_ids" uuid[] NOT NULL,
  "status" text NOT NULL,
  "current_milestone_id" uuid,
  "current_milestone_order" integer,
  "current_milestone_deadline" timestamptz(3),
  "last_milestone_order" integer,
  "template_version_id" uuid,
  "content" jsonb NOT NULL,
  "format_profile" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_reference" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "type" text NOT NULL,
  "authors" jsonb NOT NULL,
  "title" text NOT NULL,
  "year" integer,
  "vehicle" text,
  "edition" text,
  "place" text,
  "publisher" text,
  "pages" text,
  "doi" text,
  "url" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_reference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_citation" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "reference_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "locator" jsonb,
  "page" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_citation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_version" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "content" jsonb NOT NULL,
  "author_id" uuid,
  "metadata" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_version_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_submission" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "milestone_id" uuid NOT NULL,
  "milestone_order" integer NOT NULL,
  "content" jsonb NOT NULL,
  "submitted_by" uuid,
  "automatic" boolean NOT NULL DEFAULT false,
  "revoked_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_remark" (
  "id" uuid NOT NULL,
  "article_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "status" text NOT NULL,
  "anchor" jsonb NOT NULL,
  "original_text" text NOT NULL,
  "current_text" text,
  "body" text NOT NULL,
  "visible_to_team" boolean NOT NULL DEFAULT false,
  "created_by" uuid NOT NULL,
  "addressed_by" uuid,
  "addressed_at" timestamptz(3),
  "decided_by" uuid,
  "decided_at" timestamptz(3),
  "decision_reason" text,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(3) NOT NULL,
  CONSTRAINT "article_remark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article"."article_presence" (
  "article_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "cursor" jsonb NOT NULL,
  "updated_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_presence_pkey" PRIMARY KEY ("article_id","user_id")
);

CREATE UNIQUE INDEX "article_template_version_template_id_version_number_key" ON "article"."article_template_version"("template_id", "version_number");
CREATE UNIQUE INDEX "article_template_selection_event_id_key" ON "article"."article_template_selection"("event_id");
CREATE UNIQUE INDEX "article_team_id_key" ON "article"."article"("team_id");
CREATE UNIQUE INDEX "article_submission_article_id_milestone_id_key" ON "article"."article_submission"("article_id", "milestone_id");

CREATE INDEX "article_template_institution_id_active_name_idx" ON "article"."article_template"("institution_id", "active", "name");
CREATE INDEX "article_template_course_id_idx" ON "article"."article_template"("course_id");
CREATE INDEX "article_template_selection_institution_id_course_id_idx" ON "article"."article_template_selection"("institution_id", "course_id");
CREATE INDEX "article_institution_id_event_id_idx" ON "article"."article"("institution_id", "event_id");
CREATE INDEX "article_course_id_idx" ON "article"."article"("course_id");
CREATE INDEX "article_advisor_id_idx" ON "article"."article"("advisor_id");
CREATE INDEX "article_reference_article_id_title_idx" ON "article"."article_reference"("article_id", "title");
CREATE INDEX "article_citation_article_id_reference_id_idx" ON "article"."article_citation"("article_id", "reference_id");
CREATE INDEX "article_version_article_id_created_at_idx" ON "article"."article_version"("article_id", "created_at");
CREATE INDEX "article_submission_article_id_milestone_order_idx" ON "article"."article_submission"("article_id", "milestone_order");
CREATE INDEX "article_remark_article_id_status_idx" ON "article"."article_remark"("article_id", "status");
CREATE INDEX "article_remark_submission_id_idx" ON "article"."article_remark"("submission_id");

ALTER TABLE "article"."article_template_version"
  ADD CONSTRAINT "article_template_version_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "article"."article_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_template_selection"
  ADD CONSTRAINT "article_template_selection_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "article"."article_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "article"."article_template_selection"
  ADD CONSTRAINT "article_template_selection_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "article"."article_template_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "article"."article"
  ADD CONSTRAINT "article_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "article"."article_template_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "article"."article_reference"
  ADD CONSTRAINT "article_reference_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_citation"
  ADD CONSTRAINT "article_citation_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_citation"
  ADD CONSTRAINT "article_citation_reference_id_fkey"
  FOREIGN KEY ("reference_id") REFERENCES "article"."article_reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_version"
  ADD CONSTRAINT "article_version_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_submission"
  ADD CONSTRAINT "article_submission_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_remark"
  ADD CONSTRAINT "article_remark_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_remark"
  ADD CONSTRAINT "article_remark_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "article"."article_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article"."article_presence"
  ADD CONSTRAINT "article_presence_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "article"."article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
