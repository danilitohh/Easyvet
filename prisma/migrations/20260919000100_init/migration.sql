-- Technical infrastructure table only; no legacy domain schema is copied.
CREATE TABLE "InfrastructureCheck" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureCheck_pkey" PRIMARY KEY ("id")
);
