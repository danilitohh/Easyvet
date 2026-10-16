-- Keep the relocatable GiST operator classes out of the API-exposed public schema.
-- Existing exclusion constraints retain their dependency on extension object OIDs.
ALTER EXTENSION btree_gist SET SCHEMA extensions;
