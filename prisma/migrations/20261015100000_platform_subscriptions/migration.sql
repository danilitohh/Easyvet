CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "SubscriptionInterval" AS ENUM ('NONE', 'MONTHLY', 'ANNUAL');

ALTER TYPE "PlatformAuditAction" ADD VALUE 'ORGANIZATION_SUBSCRIPTION_CHANGED';

CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "eyebrow" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "monthly_price" DECIMAL(14,2),
    "annual_price" DECIMAL(14,2),
    "annual_discount_percent" DECIMAL(5,2),
    "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_plans_price_nonnegative_check"
      CHECK (("monthly_price" IS NULL OR "monthly_price" >= 0) AND ("annual_price" IS NULL OR "annual_price" >= 0)),
    CONSTRAINT "subscription_plans_discount_range_check"
      CHECK ("annual_discount_percent" IS NULL OR ("annual_discount_percent" >= 0 AND "annual_discount_percent" <= 100))
);

CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "interval" "SubscriptionInterval" NOT NULL DEFAULT 'NONE',
    "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trial_ends_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_subscriptions_dates_check"
      CHECK (("trial_ends_at" IS NULL OR "trial_ends_at" >= "starts_at") AND ("ends_at" IS NULL OR "ends_at" >= "starts_at"))
);

CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");
CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");
CREATE INDEX "organization_subscriptions_status_ends_at_idx" ON "organization_subscriptions"("status", "ends_at");

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "organization_subscriptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "organization_subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "subscription_plans" (
  "id", "code", "name", "eyebrow", "description", "currency_code",
  "monthly_price", "annual_price", "annual_discount_percent", "features", "display_order", "updated_at"
) VALUES
  ('90000000-0000-4000-8000-000000000001', 'ESSENTIAL', 'Esencial', 'Para comenzar', 'Una base clara para empezar a ordenar el día a día de tu clínica.', 'COP', 0, 0, NULL,
    ARRAY['Agenda organizada', 'Registro de pacientes', 'Acceso a la plataforma'], 1, CURRENT_TIMESTAMP),
  ('90000000-0000-4000-8000-000000000002', 'GROWTH', 'Crecimiento', 'Para equipos en expansión', 'Más contexto para que tu equipo trabaje coordinado y gane tiempo.', 'COP', NULL, NULL, NULL,
    ARRAY['Historias clínicas completas', 'Inventario conectado', 'Reportes de operación'], 2, CURRENT_TIMESTAMP),
  ('90000000-0000-4000-8000-000000000003', 'CLINIC_PRO', 'Clínica Pro', 'Para una operación completa', 'Todo el ritmo de tu clínica conectado en una experiencia de mayor alcance.', 'COP', NULL, NULL, NULL,
    ARRAY['Operación integral', 'Facturación y seguimiento', 'Soporte para tu equipo'], 3, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
