-- GitHub account IDs are external identifiers, not numeric values we operate on.
-- Store them as text so IDs outside PostgreSQL's 32-bit INTEGER range can log in.
ALTER TABLE "users"
ALTER COLUMN "github_id" TYPE TEXT
USING "github_id"::TEXT;

ALTER TABLE "Account"
ALTER COLUMN "providerAccountId" TYPE TEXT
USING "providerAccountId"::TEXT;
