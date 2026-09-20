-- CreateEnum
CREATE TYPE "OwnerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatientSex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "owners" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "document_type" TEXT,
    "document_number" TEXT,
    "document_number_normalized" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "secondary_phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "status" "OwnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "sex" "PatientSex" NOT NULL DEFAULT 'UNKNOWN',
    "birth_date" DATE,
    "birth_date_estimated" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "microchip_number" TEXT,
    "current_weight_kg" DOUBLE PRECISION,
    "sterilized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owners_organization_id_idx" ON "owners"("organization_id");

-- CreateIndex
CREATE INDEX "owners_organization_id_status_idx" ON "owners"("organization_id", "status");

-- CreateIndex
CREATE INDEX "owners_organization_id_first_name_idx" ON "owners"("organization_id", "first_name");

-- CreateIndex
CREATE INDEX "owners_organization_id_last_name_idx" ON "owners"("organization_id", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "owners_id_organization_id_key" ON "owners"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "owners_org_document_key" ON "owners"("organization_id", "document_type", "document_number_normalized");

-- CreateIndex
CREATE INDEX "patients_organization_id_idx" ON "patients"("organization_id");

-- CreateIndex
CREATE INDEX "patients_organization_id_owner_id_idx" ON "patients"("organization_id", "owner_id");

-- CreateIndex
CREATE INDEX "patients_organization_id_status_idx" ON "patients"("organization_id", "status");

-- CreateIndex
CREATE INDEX "patients_organization_id_name_normalized_idx" ON "patients"("organization_id", "name_normalized");

-- CreateIndex
CREATE INDEX "patients_organization_id_microchip_number_idx" ON "patients"("organization_id", "microchip_number");

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_owner_id_organization_id_fkey" FOREIGN KEY ("owner_id", "organization_id") REFERENCES "owners"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
