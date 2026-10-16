-- Record the legal version accepted during public account registration.
-- Nullable values preserve existing accounts; new registrations require both consents in the API.
ALTER TABLE "users"
  ADD COLUMN "privacy_consent_at" TIMESTAMPTZ(3),
  ADD COLUMN "terms_consent_at" TIMESTAMPTZ(3),
  ADD COLUMN "legal_consent_version" VARCHAR(64);
