-- CreateTable
-- Backs POST/GET /api/submissions. See prisma/schema.prisma's Submission model doc comment: this
-- route previously bypassed the storage-provider abstraction entirely and wrote only to the
-- JSON-file-backed UserDB, so submissions never reached Postgres regardless of STORAGE_PROVIDER.
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "code_content" TEXT NOT NULL,
    "execution_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "diagnostics_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_user_id_idx" ON "submissions"("user_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
