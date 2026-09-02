-- Additive-only migration (closure of audit findings P0-A/B/C): no data is deleted or altered
-- destructively. New nullable columns + a new enum + a scoped backfill UPDATE restricted to rows
-- that already match the participant-id pattern.

-- CreateEnum
CREATE TYPE "ResearchParticipantStatus" AS ENUM ('ASSIGNED', 'CONSENT_VERIFIED', 'REVOKED');

-- AlterEnum: extend AuditAction with research-study events
ALTER TYPE "AuditAction" ADD VALUE 'RESEARCH_PARTICIPANT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'RESEARCH_CONSENT_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'RESEARCH_CONSENT_REVOKED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "participant_code" TEXT;
ALTER TABLE "users" ADD COLUMN "research_status" "ResearchParticipantStatus";
ALTER TABLE "users" ADD COLUMN "research_assigned_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "research_consent_verified_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_participant_code_key" ON "users"("participant_code");

-- Backfill: rows that already match the participant-id pattern (id itself, e.g. "P002") or the
-- synthetic study email domain get participant_code = id and research_status = 'ASSIGNED', so
-- every consumer can resolve through participant_code uniformly regardless of row age. This does
-- NOT mark them CONSENT_VERIFIED -- per audit finding P0-D, existing rows are unverified/likely
-- QA contamination and consent must never be fabricated.
UPDATE "users"
SET "participant_code" = "id",
    "research_status" = 'ASSIGNED',
    "research_assigned_at" = "created_at"
WHERE "id" ~ '^P[0-9]{3,6}$' OR "email" LIKE '%@user-study.figm.local';
