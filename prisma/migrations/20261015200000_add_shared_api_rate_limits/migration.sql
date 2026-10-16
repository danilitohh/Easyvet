CREATE TABLE "api_rate_limit_buckets" (
  "key_hash" CHAR(64) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "blocked_until" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "api_rate_limit_buckets_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX "api_rate_limit_buckets_expires_at_idx"
  ON "api_rate_limit_buckets"("expires_at");

ALTER TABLE "api_rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_rate_limit_buckets" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "api_rate_limit_buckets" FROM PUBLIC, anon, authenticated, service_role;
